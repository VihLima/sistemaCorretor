import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "whatsapp";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap " +
  "transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-55 " +
  "[&_svg]:size-[1.15em] [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-faint hover:bg-surface-sunken",
  ghost: "text-ink-muted hover:bg-ink/5 hover:text-ink",
  danger: "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp-strong active:bg-whatsapp-strong",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

export type ButtonStyleOptions = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

/**
 * Classes do botão, para aplicar em `<Link>` ou `<a>` que devem parecer botões.
 * - `variant`: `primary` (ação principal, cor da marca), `secondary`, `ghost`, `danger`,
 *   `whatsapp` (exclusivo para ações que abrem o WhatsApp).
 * - `size`: `sm` 36px, `md` 44px (padrão), `lg` 48px (fluxo público / toque).
 * - `block`: ocupa toda a largura.
 */
export function buttonStyles({ variant = "primary", size = "md", block = false }: ButtonStyleOptions = {}) {
  return cn(base, variants[variant], sizes[size], block && "w-full");
}

export type ButtonProps = ComponentProps<"button"> & ButtonStyleOptions;

/** Botão padrão. `type` é "button" por padrão (use `SubmitButton` para enviar formulários). */
export function Button({ variant, size, block, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant, size, block }), className)} {...props} />;
}
