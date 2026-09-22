import type { StorageProvider } from "./index";

export class MemoryStorage implements StorageProvider {
  readonly files = new Map<string, Buffer>();
  async put(key: string, data: Buffer) {
    this.files.set(key, data);
    return { url: `memory://${key}` };
  }
  async delete(key: string) {
    this.files.delete(key);
  }
}
