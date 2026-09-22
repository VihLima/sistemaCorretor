export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.min(1, numerator / denominator);
}

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
export function formatPercent(value: number | null): string {
  return value === null ? "—" : percent.format(value);
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
export function formatBRL(value: number): string {
  return brl.format(value);
}
