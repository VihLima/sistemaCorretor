"use client";
import type { ComponentProps } from "react";
import { controlStyles } from "./controls";
import { useField } from "./Field";

export type TextareaProps = ComponentProps<"textarea"> & { invalid?: boolean };

/** Texto longo; 4 linhas por padrão, redimensionável na vertical. Dentro de `Field`, herda id e erro. */
export function Textarea({ className, invalid, id, rows = 4, ...props }: TextareaProps) {
  const field = useField();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <textarea
      id={id ?? field?.id}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      aria-describedby={field?.describedBy}
      {...props}
      className={controlStyles(isInvalid, `resize-y py-2.5 leading-relaxed ${className ?? ""}`)}
    />
  );
}
