type HeicTo = (options: {
  blob: Blob;
  type: "image/jpeg";
  quality: number;
}) => Promise<Blob>;

declare global {
  interface Window {
    __vrikshaHeicTo?: HeicTo;
  }
}

let decoderPromise: Promise<HeicTo> | null = null;

function loadHeicDecoder(): Promise<HeicTo> {
  if (window.__vrikshaHeicTo) return Promise.resolve(window.__vrikshaHeicTo);
  if (decoderPromise) return decoderPromise;

  const loading = new Promise<HeicTo>((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/vendor/heic-loader.js";
    script.onload = () => {
      if (window.__vrikshaHeicTo) resolve(window.__vrikshaHeicTo);
      else reject(new Error("The HEIC decoder did not initialise."));
    };
    script.onerror = () => reject(new Error("The HEIC decoder could not be loaded."));
    document.head.append(script);
  }).catch((error: unknown) => {
    decoderPromise = null;
    throw error;
  });

  decoderPromise = loading;
  return loading;
}

export async function convertHeicToJpeg(file: File, signal: AbortSignal): Promise<File> {
  if (signal.aborted) throw signal.reason;

  // The CSP-safe codec is a static same-origin module, kept out of Next's
  // compile graph and downloaded only after a HEIC/HEIF selection.
  const heicTo = await loadHeicDecoder();
  const converted = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  });

  if (signal.aborted) throw signal.reason;
  return new File([converted], "camera-photo.jpg", {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
