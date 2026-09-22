import { describe, expect, it } from "vitest";
import { formatBRL, formatPercent, rate } from "@/domain/format";

const plain = (s: string) => s.replace(/\s/g, " ");

describe("rate", () => {
  it("retorna null sem denominador", () => expect(rate(3, 0)).toBeNull());
  it("calcula razão limitada a 1", () => {
    expect(rate(1, 4)).toBe(0.25);
    expect(rate(5, 4)).toBe(1);
  });
});

describe("formatPercent", () => {
  it("formata em pt-BR", () => {
    expect(formatPercent(0.25)).toBe("25%");
    expect(formatPercent(0.125)).toBe("12,5%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatBRL", () => {
  it("formata sem centavos", () => {
    expect(plain(formatBRL(450000))).toBe("R$ 450.000");
  });
});
