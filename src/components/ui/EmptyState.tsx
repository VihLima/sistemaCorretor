import type { ReactNode } from "react";
import { cn } from "./cn";

export type EmptyStateProps = {
  /** Ícone lucide (ex.: `<Building2 />`). */
  icon?: ReactNode;
  /** O que falta, em uma frase curta ("Nenhum imóvel ainda"). */
  title: ReactNode;
  /** O que fazer a seguir. */
  text?: ReactNode;
  /** Botão/link da próxima ação. */
  action?: ReactNode;
  className?: string;
};

/** Estado vazio: convida à próxima ação em vez de só dizer que não há nada. */
export function EmptyState({ icon, title, text, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden
          className="mb-4 grid size-12 place-items-center rounded-full bg-brand-soft text-brand [&_svg]:size-6"
        >
          {icon}
        </div>
      )}
      <p className="font-display text-xl text-ink">{title}</p>
      {text && <p className="mt-1.5 max-w-sm text-sm text-pretty text-ink-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
