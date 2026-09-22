import { describe, expect, it } from "vitest";
import { buildLeadMessage, buildWhatsappUrl } from "@/domain/whatsapp";

describe("buildLeadMessage", () => {
  it("monta mensagem com resumo", () => {
    const msg = buildLeadMessage({
      leadName: "João",
      propertyTitle: "Casa Jardim dos Estados",
      propertyUrl: "https://x.com/imovel/casa",
      lines: [{ label: "Finalidade", value: "Comprar" }, { label: "Visita", value: "Sim" }],
    });
    expect(msg).toBe(
      "Olá, sou João.\n\nTenho interesse no imóvel: Casa Jardim dos Estados\nhttps://x.com/imovel/casa\n\nMinhas informações:\n• Finalidade: Comprar\n• Visita: Sim\n\nGostaria de receber mais informações.",
    );
  });
  it("omite a seção de informações quando não há respostas", () => {
    const msg = buildLeadMessage({ leadName: "Ana", propertyTitle: "Apto", propertyUrl: "u", lines: [] });
    expect(msg).not.toContain("Minhas informações");
  });
});

describe("buildWhatsappUrl", () => {
  it("codifica a mensagem", () => {
    expect(buildWhatsappUrl("5567999991234", "Olá & tchau")).toBe(
      "https://wa.me/5567999991234?text=Ol%C3%A1%20%26%20tchau",
    );
  });
});
