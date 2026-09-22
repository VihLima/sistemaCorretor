import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  /** Linha curta de contexto abaixo do número. */
  hint?: ReactNode;
  /** Torna o cartão um link (ex.: contatos aguardando atendimento). */
  href?: string;
  /** Destaca o cartão quando pede ação. */
  emphasis?: boolean;
};

/** Número do painel: rótulo em cima, valor em serifa, contexto embaixo. */
export function StatCard({ label, value, hint, href, emphasis }: StatCardProps) {
  const body = (
    <>
      <p className={cn("text-sm", href && "pr-5", emphasis ? "text-on-brand/85" : "text-ink-muted")}>{label}</p>
      <p className="mt-1 font-display text-[2.25rem] leading-none tracking-[-0.01em] tabular-nums">{value}</p>
      {hint && <p className={cn("mt-2 text-xs", emphasis ? "text-on-brand/85" : "text-ink-muted")}>{hint}</p>}
      {href && <ChevronRight aria-hidden className="absolute top-4 right-3 size-4 opacity-60" />}
    </>
  );
  const cls = cn(
    "relative flex flex-col rounded-card border p-4 shadow-card",
    emphasis ? "border-brand bg-brand text-on-brand" : "border-line/70 bg-surface text-ink",
    href && (emphasis ? "hover:bg-brand-strong" : "hover:border-line-strong hover:bg-surface-sunken"),
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
