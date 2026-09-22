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
  else {
    // Disco local não persiste em hospedagem serverless (Vercel): em produção exige opt-in explícito,
    // usado só pelo servidor de produção local dos testes E2E (playwright.config.ts).
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "1") {
      throw new Error(
        'STORAGE_DRIVER="local" não é permitido em produção. Configure STORAGE_DRIVER="supabase" ' +
          "(ou defina ALLOW_LOCAL_STORAGE=1 apenas para testes locais).",
      );
    }
    instance = new LocalStorage();
  }
  return instance;
}
