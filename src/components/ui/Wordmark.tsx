import { cn } from "./cn";

export type WordmarkProps = {
  /** `onBrand` para uso sobre fundo petróleo. */
  tone?: "default" | "onBrand";
  /** `md` (padrão) ou `sm` para cabeçalhos compactos. */
  size?: "sm" | "md";
  className?: string;
};

/** Marca do produto: telhado + pergunta respondida, e o nome em serifa. */
export function Wordmark({ tone = "default", size = "md", className }: WordmarkProps) {
  const onBrand = tone === "onBrand";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        aria-hidden
        viewBox="0 0 28 28"
        className={cn(size === "sm" ? "size-6 shrink-0" : "size-7 shrink-0", onBrand ? "text-white" : "text-brand")}
        fill="none"
      >
        <rect width="28" height="28" rx="7" fill="currentColor" />
        <path
          d="M7.5 13.5 14 8l6.5 5.5V20a.5.5 0 0 1-.5.5H8a.5.5 0 0 1-.5-.5v-6.5Z"
          stroke={onBrand ? "var(--color-brand)" : "white"}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="m11.2 15.6 2 2 3.6-3.8"
          stroke={onBrand ? "var(--color-brand)" : "white"}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={cn(
          "font-display leading-none font-medium tracking-[-0.01em]",
          size === "sm" ? "text-[1.15rem]" : "text-[1.3rem]",
          onBrand ? "text-white" : "text-ink",
        )}
      >
        Corretor Leads
      </span>
    </span>
  );
}
