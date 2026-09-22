import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./index";

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

/** Apenas para desenvolvimento: grava em disco e é servido por /uploads/[...key]. */
export class LocalStorage implements StorageProvider {
  async put(key: string, data: Buffer) {
    const file = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return { url: `/uploads/${key}` };
  }
  async delete(key: string) {
    await rm(path.join(LOCAL_UPLOAD_DIR, key), { force: true });
  }
}
