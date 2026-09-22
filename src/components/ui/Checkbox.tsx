"use client";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

export type CheckboxProps = Omit<ComponentProps<"input">, "type"> & {
  /** Texto clicável ao lado da caixa. */
  label: ReactNode;
  /** Explicação curta abaixo do rótulo. */
  hint?: ReactNode;
  /** Mensagem de erro (ex.: consentimento obrigatório). */
  error?: string;
};

/** Caixa de seleção com rótulo; a linha inteira é clicável (≥ 44px de altura). */
export function Checkbox({ label, hint, error, id, className, ...props }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          {...props}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-brand"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[0.9375rem] leading-snug text-ink">{label}</span>
          {hint && (
            <span id={hintId} className="text-sm text-ink-muted">
              {hint}
            </span>
          )}
        </span>
      </label>
      {error && (
        <p id={errorId} className="pl-8 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
