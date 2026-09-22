import { CLASSIFICATION_DISCLAIMER, CLASSIFICATION_LABELS } from "@/domain/labels";
import type { Classification } from "@/domain/types";
import { cn } from "./cn";

const styles: Record<Classification, { chip: string; bar: string; level: number }> = {
  HIGH: { chip: "bg-intent-high-soft text-intent-high", bar: "bg-intent-high", level: 3 },
  MEDIUM: { chip: "bg-intent-medium-soft text-intent-medium", bar: "bg-intent-medium", level: 2 },
  LOW: { chip: "bg-intent-low-soft text-intent-low", bar: "bg-intent-low", level: 1 },
  UNRATED: { chip: "border border-dashed border-line-strong text-intent-unrated", bar: "", level: 0 },
};

export type ClassificationBadgeProps = {
  /** Classificação calculada do contato. */
  value: Classification;
  /** `md` (padrão) ou `sm` para linhas densas. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Selo de intenção com um medidor de 3 barras (alta = 3, média = 2, baixa = 1, sem classificação = 0).
 * O tooltip sempre traz o aviso obrigatório `CLASSIFICATION_DISCLAIMER`; o texto também é exposto a leitores de tela.
 */
export function ClassificationBadge({ value, size = "md", className }: ClassificationBadgeProps) {
  const s = styles[value];
  return (
    <span
      title={CLASSIFICATION_DISCLAIMER}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[0.8125rem]",
        s.chip,
        className,
      )}
    >
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn("w-[3px] rounded-[1px]", n <= s.level ? s.bar : "bg-current opacity-20")}
            style={{ height: `${4 + n * 2.5}px` }}
          />
        ))}
      </span>
      {CLASSIFICATION_LABELS[value]}
      <span className="sr-only">. {CLASSIFICATION_DISCLAIMER}</span>
    </span>
  );
}
