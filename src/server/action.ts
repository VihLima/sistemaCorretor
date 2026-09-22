import "server-only";
import type { FormState } from "@/lib/form-state";
import { AppError, ValidationError } from "./errors";

/** Executa a regra de negócio e converte erros conhecidos em estado de formulário. Não chamar redirect() dentro de fn. */
export async function runAction(fn: () => Promise<string | void>): Promise<FormState> {
  try {
    const message = await fn();
    return { status: "success", message: message || undefined };
  } catch (e) {
    if (e instanceof ValidationError) return { status: "error", message: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof AppError) return { status: "error", message: e.message };
    console.error(e);
    return { status: "error", message: "Algo deu errado. Tente novamente em instantes." };
  }
}
