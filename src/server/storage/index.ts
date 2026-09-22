import { LocalStorage } from "./local";
import { MemoryStorage } from "./memory";
import { SupabaseStorage } from "./supabase";

export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "memory") instance = new MemoryStorage();
  else if (driver === "supabase") instance = new SupabaseStorage();
  else instance = new LocalStorage();
  return instance;
}
