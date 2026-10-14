// Phone photos run 3-12 MB; the receipt reader doesn't need that much, and
// the api caps uploads at 10 MB per file. Large photos are scaled so the long
// side is at most MAX_LONG_SIDE, but never so far that the short side drops
// below MIN_SHORT_SIDE, so a tall receipt screenshot stays legible.
const MAX_LONG_SIDE = 2500;
const MIN_SHORT_SIDE = 1100;
const LEAVE_ALONE_BYTES = 1.5 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

/** Re-encodes a large image as a smaller JPEG; anything else passes through. */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size <= LEAVE_ALONE_BYTES) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // A format the browser can't decode: send it as-is and let the api
    // accept or reject it.
    return file;
  }

  const long = Math.max(bitmap.width, bitmap.height);
  const short = Math.min(bitmap.width, bitmap.height);
  const scale = Math.min(
    1,
    Math.max(MAX_LONG_SIDE / long, MIN_SHORT_SIDE / short),
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  // Keep the original if re-encoding somehow made it bigger.
  return blob && blob.size < file.size ? blob : file;
}
