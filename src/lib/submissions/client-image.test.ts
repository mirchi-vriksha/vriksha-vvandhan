import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compress: vi.fn(),
  heicTo: vi.fn(),
}));

vi.mock("browser-image-compression", () => ({ default: mocks.compress }));
vi.mock("@/lib/submissions/client-heic", () => ({
  convertHeicToJpeg: async (file: File) => {
    const converted = await mocks.heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });
    return new File([converted], "camera-photo.jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  },
}));

import {
  prepareImage,
  validateImageInput,
} from "@/lib/submissions/client-image";

class FailingImageWorker {
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage() {
    this.onerror?.(new Event("error"));
  }

  terminate() {}
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("Worker", undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")
    .mockReturnValue("data:image/webp;base64,AAAA");
  mocks.compress.mockImplementation(async (file: File, options: { fileType: string }) =>
    new File(["prepared"], file.name, { type: options.fileType }),
  );
  mocks.heicTo.mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
});

describe("client image preparation", () => {
  it("accepts a known extension when an operating system supplies a generic MIME", () => {
    const file = new File(["photo"], "tree.JPG", { type: "application/octet-stream" });
    expect(() => validateImageInput(file)).not.toThrow();
  });

  it("retries on the main thread when the project worker cannot prepare the image", async () => {
    vi.stubGlobal("Worker", FailingImageWorker);
    const file = new File(["photo"], "tree.jpg", { type: "image/jpeg" });

    await expect(prepareImage(file, { signal: new AbortController().signal }))
      .resolves.toMatchObject({ extension: "webp", mimeType: "image/webp" });
    expect(mocks.compress).toHaveBeenCalledOnce();
    expect(mocks.compress).toHaveBeenCalledWith(file, expect.objectContaining({
      useWebWorker: false,
      fileType: "image/webp",
    }));
  });

  it("decodes HEIC/HEIF to JPEG before browser compression", async () => {
    const file = new File(["heic"], "new-phone.HEIC", { type: "image/heic" });

    await expect(prepareImage(file, { signal: new AbortController().signal }))
      .resolves.toMatchObject({ extension: "webp", originalBytes: file.size });
    expect(mocks.heicTo).toHaveBeenCalledWith({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });
    expect(mocks.compress).toHaveBeenCalledWith(
      expect.objectContaining({ name: "camera-photo.jpg", type: "image/jpeg" }),
      expect.any(Object),
    );
  });
});
