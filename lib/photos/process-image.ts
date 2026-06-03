import heic2any from "heic2any";
import exifr from "exifr";
import { fitWithin } from "@/lib/photos/fit";

const DISPLAY_MAX = 2048;
const THUMB_MAX = 400;
const DISPLAY_QUALITY = 0.82;
const THUMB_QUALITY = 0.7;

export interface ProcessedPhoto {
  thumb: Blob;
  display: Blob;
  original: Blob;
  displayWidth: number;
  displayHeight: number;
  contentType: string;
  takenAt: string | null;
}

function isHeic(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.hei[cf]$/i.test(file.name)
  );
}

/** Read EXIF DateTimeOriginal as an ISO string, or null if absent/unreadable. */
async function readTakenAt(file: File): Promise<string | null> {
  try {
    const exif = await exifr.parse(file, ["DateTimeOriginal"]);
    const d = exif?.DateTimeOriginal;
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

/** Draw a bitmap scaled into a canvas and return a JPEG blob. */
async function toJpeg(
  bitmap: ImageBitmap,
  max: number,
  quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Canvas toBlob failed");
  return { blob, width, height };
}

/**
 * Turn a selected file into thumb + display JPEGs (keeping the untouched
 * original) and read its EXIF capture time. Throws if the image can't be
 * decoded (caller skips that file with a visible message).
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const takenAt = await readTakenAt(file);

  // Decode source: HEIC -> JPEG blob first, otherwise use the file directly.
  let decodeSource: Blob = file;
  if (isHeic(file)) {
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    decodeSource = Array.isArray(converted) ? converted[0] : converted;
  }

  // `imageOrientation: from-image` bakes EXIF rotation into the pixels.
  const bitmap = await createImageBitmap(decodeSource, {
    imageOrientation: "from-image",
  });

  try {
    const display = await toJpeg(bitmap, DISPLAY_MAX, DISPLAY_QUALITY);
    const thumb = await toJpeg(bitmap, THUMB_MAX, THUMB_QUALITY);
    return {
      thumb: thumb.blob,
      display: display.blob,
      original: file,
      displayWidth: display.width,
      displayHeight: display.height,
      contentType: file.type || "application/octet-stream",
      takenAt,
    };
  } finally {
    bitmap.close();
  }
}

/** File extension for the original, derived from its name (fallback "bin"). */
export function originalExt(file: File): string {
  const m = file.name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "bin";
}
