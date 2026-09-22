import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_UPLOAD_DIR } from "@/server/storage/local";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") return new Response(null, { status: 404 });
  const { key } = await params;
  const file = path.resolve(LOCAL_UPLOAD_DIR, ...key);
  if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return new Response(null, { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(data, {
      headers: { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
