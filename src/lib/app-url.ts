import "server-only";
import { headers } from "next/headers";

export async function getAppUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // Checado na requisição (não no import) para o `next build` continuar funcionando sem a variável.
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL não configurada. Defina a URL pública do app (ex.: https://seuapp.com.br) nas variáveis de ambiente.");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
