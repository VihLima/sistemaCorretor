"use client";
import type { ComponentProps } from "react";
import { controlStyles } from "./controls";
import { useField } from "./Field";

export type InputProps = ComponentProps<"input"> & {
  /** Força o estado de erro fora de um `Field`. */
  invalid?: boolean;
};

/** Campo de texto (44px). Dentro de `Field`, herda id, descrição e estado de erro. */
export function Input({ className, invalid, id, ...props }: InputProps) {
  const field = useField();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <input
      id={id ?? field?.id}
      aria-invalid={isInvalid || undefined}
      aria-describedby={field?.describedBy}
      {...props}
      className={controlStyles(isInvalid, `h-11 ${className ?? ""}`)}
    />
  );
}
