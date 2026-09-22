import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_FILTERS, leadsPageHref, readLeadListParams, totalPages } from "@/lib/lead-list-params";

describe("readLeadListParams", () => {
  it("sem parâmetros: só concluídos, sem filtros na URL", () => {
    expect(readLeadListParams({})).toEqual({ raw: {}, filters: { complete: "yes" } });
  });

  it("complete=all inclui incompletos; qualquer outro valor mantém só concluídos", () => {
    expect(readLeadListParams({ complete: "all" }).filters).toEqual({ complete: undefined });
    expect(readLeadListParams({ complete: "no" }).filters).toEqual({ complete: "yes" });
    expect(readLeadListParams({ complete: "whatever" }).filters).toEqual({ complete: "yes" });
  });

  it("repassa filtros válidos e guarda a URL crua para os links", () => {
    const r = readLeadListParams({ status: "NEW", channel: "INSTAGRAM", classification: "HIGH", q: "ana", days: "30", page: "2", propertyId: "p1" });
    expect(r.filters).toEqual({ status: "NEW", channel: "INSTAGRAM", classification: "HIGH", q: "ana", days: "30", page: "2", propertyId: "p1", complete: "yes" });
    expect(r.raw).toEqual({ status: "NEW", channel: "INSTAGRAM", classification: "HIGH", q: "ana", days: "30", page: "2", propertyId: "p1" });
  });

  it("usa o primeiro valor de parâmetros repetidos e ignora chaves desconhecidas ou vazias", () => {
    const r = readLeadListParams({ status: ["LOST", "NEW"], foo: "bar", q: "" });
    expect(r.raw).toEqual({ status: "LOST" });
    expect(r.filters).toEqual({ status: "LOST", complete: "yes" });
  });

  it.each([
    [{ status: "BOGUS" }],
    [{ classification: "ALTA" }],
    [{ channel: "tiktok" }],
    [{ days: "-7" }],
    [{ days: "abc" }],
    [{ q: "x".repeat(101) }],
    [{ propertyId: "p".repeat(51) }],
  ])("parâmetro inválido %j: todos os filtros caem para o padrão", (sp) => {
    // um filtro válido junto (canal) também é descartado
    const r = readLeadListParams({ channel: "FACEBOOK", ...sp });
    expect(r.filters).toEqual(DEFAULT_LEAD_FILTERS);
  });

  it.each(["0", "-1", "2.5", "abc"])("página inválida (%s) volta ao padrão (página 1)", (page) => {
    expect(readLeadListParams({ page, status: "NEW" }).filters).toEqual(DEFAULT_LEAD_FILTERS);
  });

  it("página válida acima do total é repassada (o serviço devolve lista vazia)", () => {
    expect(readLeadListParams({ page: "999" }).filters).toEqual({ page: "999", complete: "yes" });
  });
});

describe("totalPages", () => {
  it("arredonda para cima e nunca é menor que 1", () => {
    expect(totalPages(0, 25)).toBe(1);
    expect(totalPages(1, 25)).toBe(1);
    expect(totalPages(25, 25)).toBe(1);
    expect(totalPages(26, 25)).toBe(2);
    expect(totalPages(51, 25)).toBe(3);
  });
});

describe("leadsPageHref", () => {
  it("mantém os filtros e omite page=1", () => {
    expect(leadsPageHref({ status: "NEW", page: "3" }, 1)).toBe("/painel/leads?status=NEW");
    expect(leadsPageHref({ status: "NEW" }, 2)).toBe("/painel/leads?status=NEW&page=2");
    expect(leadsPageHref({}, 1)).toBe("/painel/leads");
    expect(leadsPageHref({ page: "2" }, 0)).toBe("/painel/leads");
  });
});
