"use client";
import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "./cn";

type FieldContextValue = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldContextValue | null>(null);

/** Usado por Input/Textarea/Select para herdar id, aria-describedby e estado de erro do `Field`. */
export function useField() {
  return useContext(FieldContext);
}

export type FieldProps = {
  /** Rótulo visível do campo. */
  label: ReactNode;
  /** Texto de ajuda abaixo do controle (substituído pela mensagem de erro quando houver). */
  hint?: ReactNode;
  /** Mensagem de erro (ex.: `state.fieldErrors?.email`). Quando presente, marca o controle como inválido. */
  error?: string;
  /** id do controle; gerado automaticamente se omitido. */
  id?: string;
  /** Mostra o marcador "opcional" ao lado do rótulo (não altera validação). */
  optional?: boolean;
  /** Conteúdo à direita do rótulo (ex.: contador de caracteres). */
  aside?: ReactNode;
  className?: string;
  /** Um único controle: `Input`, `Textarea` ou `Select`. */
  children: ReactNode;
};

/** Rótulo + controle + ajuda + erro, com ligações de acessibilidade automáticas. */
export function Field({ label, hint, error, id, optional, aside, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const showHint = Boolean(hint) && !error;
  const hintId = showHint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error) }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={controlId} className="text-sm font-medium text-ink">
            {label}
            {optional && <span className="ml-1.5 font-normal text-ink-faint">opcional</span>}
          </label>
          {aside && <span className="text-xs text-ink-faint tabular-nums">{aside}</span>}
        </div>
        {children}
        {error && (
          <p id={errorId} className="text-sm text-danger">
            {error}
          </p>
        )}
        {showHint && (
          <p id={hintId} className="text-sm text-ink-muted">
            {hint}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
