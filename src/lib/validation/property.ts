import { z } from "zod";
import { PROPERTY_PURPOSES, PROPERTY_TYPES } from "@/domain/types";
import { emptyToUndefined } from "./parse";

/** "1.250.000,00" → 1250000 ; "450000" → 450000 */
export function parseMoney(v: unknown): unknown {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || !v.trim()) return undefined;
  const digits = v.replace(/,\d{1,2}$/, "").replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
}

/** "180,5" → 180.5 */
function parseDecimal(v: unknown): unknown {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || !v.trim()) return undefined;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? v : n;
}

const optionalMoney = z.preprocess(parseMoney, z.number().int().min(0).max(1_000_000_000).optional()).transform((v) => v ?? null);
const optionalCount = z.preprocess(emptyToUndefined, z.coerce.number().int("Use um número inteiro").min(0).max(99).optional()).transform((v) => v ?? null);
const optionalArea = z.preprocess(parseDecimal, z.number("Área inválida").min(0).max(10_000_000).optional()).transform((v) => v ?? null);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const propertySchema = z.object({
  title: z.string().trim().min(5, "Título muito curto (mín. 5 caracteres)").max(120),
  type: z.enum(PROPERTY_TYPES, "Escolha o tipo"),
  purpose: z.enum(PROPERTY_PURPOSES, "Escolha a finalidade"),
  price: z.preprocess(parseMoney, z.number("Informe o preço").int().positive("Informe o preço").max(1_000_000_000)),
  condoFee: optionalMoney,
  iptu: optionalMoney,
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  neighborhood: z.string().trim().min(2, "Informe o bairro").max(80),
  address: optionalText(200),
  showAddress: checkbox,
  bedrooms: optionalCount,
  suites: optionalCount,
  bathrooms: optionalCount,
  parkingSpots: optionalCount,
  builtArea: optionalArea,
  landArea: optionalArea,
  description: z.string().trim().min(20, "Descreva o imóvel (mín. 20 caracteres)").max(5000),
  highlights: z
    .preprocess((v) => (typeof v === "string" ? v.split("\n") : (v ?? [])), z.array(z.string()))
    .transform((a) => a.map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(120, "Diferencial muito longo")).max(20, "Máximo de 20 diferenciais")),
  financingInfo: optionalText(1000),
});

export type PropertyInput = z.infer<typeof propertySchema>;
