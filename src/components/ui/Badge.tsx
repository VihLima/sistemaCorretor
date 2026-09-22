import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-neutral-soft text-neutral",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export type BadgeProps = {
  /** Cor semântica: `neutral` (padrão), `success`, `warning`, `danger`, `info`. */
  tone?: BadgeTone;
  /** Ícone lucide opcional antes do texto. */
  icon?: ReactNode;
  /** Texto do tooltip nativo. */
  title?: string;
  className?: string;
  children: ReactNode;
};

/** Etiqueta curta de estado (status do imóvel, status do contato, "Incompleto"…). */
export function Badge({ tone = "neutral", icon, title, className, children }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
