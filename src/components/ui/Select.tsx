"use client";
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./cn";
import { controlStyles } from "./controls";
import { useField } from "./Field";

export type SelectOption = { value: string; label: string };

export type SelectProps = ComponentProps<"select"> & {
  /** Força o estado de erro fora de um `Field`. */
  invalid?: boolean;
  /** Opções simples; alternativamente passe `<option>`s como children. */
  options?: SelectOption[];
  /** Primeira opção com valor vazio (ex.: "Selecione"). */
  placeholder?: string;
};

/** Select nativo estilizado (acessível e confortável no celular). `className` vai no invólucro. */
export function Select({ className, invalid, id, options, placeholder, children, ...props }: SelectProps) {
  const field = useField();
  const isInvalid = invalid ?? field?.invalid ?? false;
  return (
    <div className={cn("relative", className)}>
      <select
        id={id ?? field?.id}
        aria-invalid={isInvalid || undefined}
        aria-describedby={field?.describedBy}
        {...props}
        className={controlStyles(isInvalid, "h-11 cursor-pointer appearance-none pr-10")}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
