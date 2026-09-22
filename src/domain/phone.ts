/** Normaliza telefone brasileiro para dígitos com DDI 55 (ex.: 5567999991234). */
export function normalizeBrPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!digits.startsWith("55") || (digits.length !== 12 && digits.length !== 13)) return null;
  return digits;
}

export function formatBrPhone(digits: string): string {
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return digits;
}
