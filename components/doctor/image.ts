"use client";

export type Captured = { b64: string; mime: "image/jpeg"; previewUrl: string; caseId?: string };

const LONG_EDGE = 1600;

/** Draws any image source onto a canvas resized to 1600 px on the long edge, exported as JPEG 0.85. */
export function toJpeg(src: CanvasImageSource, w: number, h: number): Captured {
  const scale = Math.min(1, LONG_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  const previewUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { b64: previewUrl.split(",")[1], mime: "image/jpeg", previewUrl };
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}

export async function fileToJpeg(file: File): Promise<Captured> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return toJpeg(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function urlToJpeg(url: string, caseId?: string): Promise<Captured> {
  const img = await loadImage(url);
  return { ...toJpeg(img, img.naturalWidth || 1200, img.naturalHeight || 1600), caseId };
}
