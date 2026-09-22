import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";

/** Indicador de carregamento; herda a cor e o tamanho do texto. `label` é lido por leitores de tela. */
export function Spinner({ className, label = "Carregando" }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex">
      <LoaderCircle aria-hidden className={cn("size-[1.15em] motion-safe:animate-spin", className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
