import "server-only";
import { ConflictError, NotFoundError, RateLimitError, ValidationError } from "./errors";
import { checkRateLimit } from "./rate-limit";

/**
 * IP do cliente, usado só como chave do limitador em memória (nunca é gravado).
 * Em produção dependemos da plataforma definir `x-forwarded-for` (a Vercel define e sobrescreve o valor
 * enviado pelo cliente); "local" é o fallback do ambiente de desenvolvimento, onde não há proxy.
 */
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export function enforceRateLimit(request: Request, bucket: string, limit: number, windowMs: number) {
  if (!checkRateLimit(`${bucket}:${clientIp(request)}`, limit, windowMs)) throw new RateLimitError();
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return JSON.parse(await request.text());
  } catch {
    throw new ValidationError({ _form: "Requisição inválida" }, "Requisição inválida");
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ValidationError) return Response.json({ message: e.message, fieldErrors: e.fieldErrors }, { status: 422 });
  if (e instanceof NotFoundError) return Response.json({ message: e.message }, { status: 404 });
  if (e instanceof ConflictError) return Response.json({ message: e.message }, { status: 409 });
  if (e instanceof RateLimitError) return Response.json({ message: e.message }, { status: 429 });
  console.error(e);
  return Response.json({ message: "Algo deu errado. Tente novamente." }, { status: 500 });
}
