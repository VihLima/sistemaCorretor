import { z } from "zod";
import { normalizeBrPhone } from "@/domain/phone";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);

export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeBrPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Número inválido. Use DDD + número" });
      return z.NEVER;
    }
    return n;
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  creci: optionalText(30),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  bio: optionalText(600),
  agencyName: optionalText(100),
  instagramUrl: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => {
      if (!v) return null;
      if (/^https?:\/\//i.test(v)) return v;
      return `https://instagram.com/${v.replace(/^@/, "")}`;
    }),
});
