import { Bath, BedDouble, BedSingle, Car, LandPlot, Ruler, type LucideIcon } from "lucide-react";

export type PropertyFactsProps = {
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  builtArea: number | null;
  landArea: number | null;
};

const area = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Características principais com ícones; campos vazios não aparecem. */
export function PropertyFacts(p: PropertyFactsProps) {
  const facts: { icon: LucideIcon; value: string; label: string }[] = [];
  if (p.bedrooms != null) facts.push({ icon: BedDouble, value: String(p.bedrooms), label: plural(p.bedrooms, "quarto", "quartos") });
  if (p.suites != null && p.suites > 0) facts.push({ icon: BedSingle, value: String(p.suites), label: plural(p.suites, "suíte", "suítes") });
  if (p.bathrooms != null) facts.push({ icon: Bath, value: String(p.bathrooms), label: plural(p.bathrooms, "banheiro", "banheiros") });
  if (p.parkingSpots != null) facts.push({ icon: Car, value: String(p.parkingSpots), label: plural(p.parkingSpots, "vaga", "vagas") });
  if (p.builtArea != null) facts.push({ icon: Ruler, value: `${area.format(p.builtArea)} m²`, label: "área construída" });
  if (p.landArea != null) facts.push({ icon: LandPlot, value: `${area.format(p.landArea)} m²`, label: "terreno" });
  if (facts.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3" aria-label="Características">
      {facts.map(({ icon: Icon, value, label }) => (
        <li key={label} className="flex items-center gap-3 border-t border-line py-3.5">
          <Icon aria-hidden className="size-5 shrink-0 text-brand" strokeWidth={1.6} />
          <span className="flex min-w-0 flex-col">
            <span className="text-[1.0625rem] leading-tight font-semibold text-ink tabular-nums">{value}</span>
            <span className="text-sm leading-tight text-ink-muted">{label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
