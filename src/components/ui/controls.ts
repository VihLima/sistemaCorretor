import { cn } from "./cn";

/** Aparência comum de Input/Textarea/Select. */
export function controlStyles(invalid: boolean, extra?: string) {
  return cn(
    "w-full rounded-control border bg-surface px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-faint",
    "transition-[border-color,box-shadow] duration-150 outline-none",
    "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted",
    invalid
      ? "border-danger focus:ring-3 focus:ring-danger/15"
      : "border-line-strong hover:border-ink-faint focus:border-brand focus:ring-3 focus:ring-brand/15",
    extra,
  );
}
