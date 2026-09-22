import type { z } from "zod";
import { ValidationError } from "@/server/errors";

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    fieldErrors[key] ??= issue.message;
  }
  throw new ValidationError(fieldErrors);
}

/** Converte "" em undefined (campos opcionais vindos de FormData). */
export const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;
