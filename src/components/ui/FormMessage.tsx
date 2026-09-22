import { CircleAlert, CircleCheck } from "lucide-react";
import type { FormState } from "@/lib/form-state";
import { cn } from "./cn";

export type FormMessageProps = {
  /** Estado retornado pela server action (`useActionState`). Não renderiza nada em `idle` ou sem `message`. */
  state: FormState;
  className?: string;
};

/** Mensagem geral do formulário (erro ou sucesso), anunciada a leitores de tela. */
export function FormMessage({ state, className }: FormMessageProps) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-control px-3.5 py-2.5 text-sm",
        isError ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
        className,
      )}
    >
      {isError ? (
        <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
      ) : (
        <CircleCheck aria-hidden className="mt-px size-4 shrink-0" />
      )}
      <span>{state.message}</span>
    </p>
  );
}
