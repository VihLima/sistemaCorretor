export type SniffedImage =
  | { contentType: "image/jpeg"; ext: "jpg" }
  | { contentType: "image/png"; ext: "png" }
  | { contentType: "image/webp"; ext: "webp" };

export function sniffImageType(data: Buffer): SniffedImage | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { contentType: "image/jpeg", ext: "jpg" };
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { contentType: "image/png", ext: "png" };
  if (data.length >= 12 && data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WEBP") return { contentType: "image/webp", ext: "webp" };
  return null;
}
