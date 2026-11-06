"use client";
// Resize photos on the phone before upload: a 4 MB screenshot becomes ~300 KB,
// which matters on roaming data in China. Falls back to the original file if
// the browser cannot decode it (e.g. HEIC on some Android browsers).

export interface ProcessedImage {
  full: Blob;
  thumb: Blob | null;
  width: number | null;
  height: number | null;
  type: string;
}

async function draw(bitmap: ImageBitmap, max: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}

export async function processImage(file: Blob): Promise<ProcessedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const [full, thumb] = await Promise.all([draw(bitmap, 2000, 0.85), draw(bitmap, 600, 0.78)]);
    const out = { full: full ?? file, thumb, width: bitmap.width, height: bitmap.height, type: full ? "image/jpeg" : file.type };
    bitmap.close();
    return out;
  } catch {
    return { full: file, thumb: null, width: null, height: null, type: file.type || "image/jpeg" };
  }
}

export function extFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic" || type === "image/heif") return "heic";
  return "jpg";
}
