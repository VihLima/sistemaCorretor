import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/domain/slug";

describe("slugify", () => {
  it("remove acentos, pontuação e espaços", () => {
    expect(slugify("Casa no Jardim dos Estados")).toBe("casa-no-jardim-dos-estados");
    expect(slugify("Apartamento – Centro, 3 quartos!")).toBe("apartamento-centro-3-quartos");
    expect(slugify("Sobrado Carandá Bosque")).toBe("sobrado-caranda-bosque");
  });
  it("usa fallback quando não sobra nada", () => {
    expect(slugify("!!!")).toBe("imovel");
  });
  it("limita a 80 caracteres sem hífen no final", () => {
    const s = slugify("a".repeat(79) + " bbbb");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("retorna o base quando livre", async () => {
    expect(await uniqueSlug("casa", async () => false)).toBe("casa");
  });
  it("acrescenta sufixo numérico quando ocupado", async () => {
    const taken = new Set(["casa", "casa-2"]);
    expect(await uniqueSlug("casa", async (s) => taken.has(s))).toBe("casa-3");
  });
});
