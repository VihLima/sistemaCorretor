import type { ReactNode } from "react";
import { cn } from "./cn";

export type CardProps = {
  /** Título da seção (h2 por padrão). */
  title?: ReactNode;
  /** Linha de apoio abaixo do título. */
  description?: ReactNode;
  /** Ações alinhadas à direita do cabeçalho (botões, links). */
  actions?: ReactNode;
  /** Nível do título; use "h3" quando o cartão estiver dentro de outra seção. */
  titleAs?: "h2" | "h3";
  /** `padded` (padrão) aplica o espaçamento interno; `false` para listas/tabelas encostadas na borda. */
  padded?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Superfície branca do painel. Com `title`, vira uma `<section>` rotulada. */
export function Card({ title, description, actions, titleAs: Title = "h2", padded = true, className, children }: CardProps) {
  const hasHeader = title || description || actions;
  const Tag = title ? "section" : "div";
  return (
    <Tag className={cn("rounded-card border border-line/70 bg-surface shadow-card", className)}>
      {hasHeader && (
        <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6", !padded && "pb-4")}>
          <div className="min-w-0 space-y-1">
            {title && <Title className="text-base font-semibold text-ink">{title}</Title>}
            {description && <p className="text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children !== undefined && (
        <div className={cn(padded && "px-5 pb-5 sm:px-6 sm:pb-6", padded && (hasHeader ? "pt-4" : "pt-5 sm:pt-6"))}>
          {children}
        </div>
      )}
    </Tag>
  );
}
