import { z } from "zod";
import { CHANNELS, CLASSIFICATIONS, LEAD_STATUSES } from "@/domain/types";
import { emptyToUndefined } from "@/lib/validation/parse";

const opt = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

/** Filtros da lista de contatos (painel). */
export const leadFiltersSchema = z.object({
  propertyId: opt(z.string().max(50)),
  classification: opt(z.enum(CLASSIFICATIONS)),
  status: opt(z.enum(LEAD_STATUSES)),
  channel: opt(z.enum(CHANNELS)),
  complete: opt(z.enum(["yes", "no"])),
  q: opt(z.string().trim().max(100)),
  days: opt(z.coerce.number().int().positive().max(3650)),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
});

export type LeadFilters = z.input<typeof leadFiltersSchema>;
export type ParsedLeadFilters = z.output<typeof leadFiltersSchema>;
