import { PUBLIC_SUBMISSION, type PreparedImageExtension } from "@/config/public-submission";

export type PreparedImage = {
  file: File;
  extension: PreparedImageExtension;
  mimeType: "image/webp" | "image/jpeg";
  originalBytes: number;
  preparedBytes: number;
};

export class ClientImageError extends Error {
  constructor(
    public readonly code:
      | "input_too_large"
      | "unsupported_image"
      | "heic_unsupported"
      | "compression_failed"
      | "prepared_too_large",
    message: string,
  ) {
    super(message);
    this.name = "ClientImageError";
  }
}

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function validateImageInput(file: File): void {
  if (file.size <= 0) {
    throw new ClientImageError("unsupported_image", "Choose a non-empty photograph.");
  }
  if (file.size > PUBLIC_SUBMISSION.inputMaxBytes) {
    throw new ClientImageError(
      "input_too_large",
      "That photograph is larger than 15 MB. Choose a smaller image.",
    );
  }

  const extension = extensionOf(file.name);
  const validMime = PUBLIC_SUBMISSION.acceptedInputMimeTypes.includes(
    file.type.toLowerCase() as (typeof PUBLIC_SUBMISSION.acceptedInputMimeTypes)[number],
  );
  const validExtension = PUBLIC_SUBMISSION.acceptedInputExtensions.includes(
    extension as (typeof PUBLIC_SUBMISSION.acceptedInputExtensions)[number],
  );

  // File MIME reporting differs across browsers and operating systems. Some
  // valid camera files arrive as application/octet-stream, so accept a known
  // extension or a known image MIME and let decoding validate the bytes.
  if (!validMime && !validExtension) {
    throw new ClientImageError(
      "unsupported_image",
      "Choose a JPEG, PNG, WebP, HEIC or HEIF photograph.",
    );
  }
}

function isHeic(file: File): boolean {
  return ["heic", "heif", "hif"].includes(extensionOf(file.name)) ||
    ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]
      .includes(file.type.toLowerCase());
}

async function supportsWebpOutput(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

async function compressOnMainThread(
  file: File,
  outputMime: "image/webp" | "image/jpeg",
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, {
    maxSizeMB: PUBLIC_SUBMISSION.preparedTargetBytes / 1024 / 1024,
    maxWidthOrHeight: PUBLIC_SUBMISSION.maximumDimension,
    useWebWorker: false,
    preserveExif: false,
    fileType: outputMime,
    initialQuality: 0.88,
    signal,
    onProgress,
  });
}

function compressInProjectWorker(
  file: File,
  outputMime: "image/webp" | "image/jpeg",
  signal: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./client-image.worker.ts", import.meta.url), {
      type: "module",
      name: "vriksha-image-preparation",
    });

    const stop = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      stop();
      reject(signal.reason ?? new DOMException("Image preparation cancelled.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });

    worker.onerror = () => {
      stop();
      reject(new Error("The image worker could not start."));
    };
    worker.onmessage = (event: MessageEvent<
      | { type: "progress"; progress: number }
      | { type: "success"; file: File }
      | { type: "error"; message: string }
    >) => {
      if (event.data.type === "progress") {
        onProgress?.(event.data.progress);
        return;
      }
      stop();
      if (event.data.type === "success") resolve(event.data.file);
      else reject(new Error(event.data.message));
    };

    worker.postMessage({ file, outputMime });
  });
}

export async function prepareImage(
  file: File,
  options: { signal: AbortSignal; onProgress?: (progress: number) => void },
): Promise<PreparedImage> {
  validateImageInput(file);
  const outputMime = (await supportsWebpOutput()) ? "image/webp" : "image/jpeg";

  try {
    const heicInput = isHeic(file);
    if (heicInput) options.onProgress?.(5);
    const compressionInput = heicInput
      ? await import("@/lib/submissions/client-heic").then(({ convertHeicToJpeg }) =>
          convertHeicToJpeg(file, options.signal),
        )
      : file;
    if (heicInput) options.onProgress?.(25);
    const reportProgress = heicInput
      ? (progress: number) => options.onProgress?.(25 + progress * 0.75)
      : options.onProgress;

    let prepared: File;
    if (typeof Worker === "function") {
      try {
        prepared = await compressInProjectWorker(
          compressionInput,
          outputMime,
          options.signal,
          reportProgress,
        );
      } catch (workerError) {
        if (options.signal.aborted) throw workerError;
        // Safari and some embedded browsers expose Worker without the canvas
        // APIs required for image compression. Retry on the browser main thread.
        prepared = await compressOnMainThread(
          compressionInput,
          outputMime,
          options.signal,
          reportProgress,
        );
      }
    } else {
      prepared = await compressOnMainThread(
        compressionInput,
        outputMime,
        options.signal,
        reportProgress,
      );
    }

    if (prepared.size > PUBLIC_SUBMISSION.preparedMaxBytes) {
      throw new ClientImageError(
        "prepared_too_large",
        "That photograph could not be reduced below 2 MB. Please choose a simpler or smaller image.",
      );
    }

    const extension: PreparedImageExtension = outputMime === "image/webp" ? "webp" : "jpg";
    const safeFile = new File([prepared], `submission.${extension}`, {
      type: outputMime,
      lastModified: Date.now(),
    });

    return {
      file: safeFile,
      extension,
      mimeType: outputMime,
      originalBytes: file.size,
      preparedBytes: safeFile.size,
    };
  } catch (error) {
    if (error instanceof ClientImageError || options.signal.aborted) throw error;
    if (isHeic(file)) {
      throw new ClientImageError(
        "heic_unsupported",
        "This browser could not prepare that HEIC photo. Please take a new photo or choose a JPEG, PNG or WebP image.",
      );
    }
    throw new ClientImageError(
      "compression_failed",
      "We could not prepare that photograph. Please replace it or try again.",
    );
  }
}

export function revokePreviewUrl(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}
