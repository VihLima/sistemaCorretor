import { leadFiltersSchema, type LeadFilters } from "@/lib/validation/lead-filters";

/** Parâmetros de URL aceitos por `/painel/leads`. */
export const LEAD_LIST_PARAM_KEYS = ["propertyId", "classification", "status", "channel", "complete", "q", "days", "page"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

/** Sem filtros: só os contatos que concluíram o questionário, página 1. */
export const DEFAULT_LEAD_FILTERS: LeadFilters = { complete: "yes" };

export type LeadListParams = {
  /** Parâmetros presentes na URL (primeiro valor de cada chave, vazios omitidos) — usados para montar links. */
  raw: Record<string, string>;
  /** Filtros para `listLeads`, já validados; se algum parâmetro for inválido, todos caem para o padrão. */
  filters: LeadFilters;
};

/**
 * Lê os filtros da URL da lista de contatos.
 * - `complete=all` inclui os incompletos; sem o parâmetro (ou outro valor), só os concluídos.
 * - Parâmetro inválido (status digitado à mão, página 0, etc.): ignora todos os filtros em vez de quebrar.
 */
export function readLeadListParams(sp: SearchParams): LeadListParams {
  const raw: Record<string, string> = {};
  for (const k of LEAD_LIST_PARAM_KEYS) {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s) raw[k] = s;
  }
  const { complete, ...rest } = raw;
  const filters: LeadFilters = { ...rest, complete: complete === "all" ? undefined : "yes" };
  return { raw, filters: leadFiltersSchema.safeParse(filters).success ? filters : DEFAULT_LEAD_FILTERS };
}

/** Total de páginas (no mínimo 1, mesmo sem resultados). */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Link para a página `page` mantendo os demais parâmetros; a página 1 não leva `page`. */
export function leadsPageHref(raw: Record<string, string>, page: number): string {
  const qs = new URLSearchParams(raw);
  if (page > 1) qs.set("page", String(page));
  else qs.delete("page");
  const s = qs.toString();
  return s ? `/painel/leads?${s}` : "/painel/leads";
}
