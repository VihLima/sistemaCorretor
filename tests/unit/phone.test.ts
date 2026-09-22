import { describe, expect, it } from "vitest";
import { formatBrPhone, normalizeBrPhone } from "@/domain/phone";

describe("normalizeBrPhone", () => {
  it.each([
    ["(67) 99999-1234", "5567999991234"],
    ["+55 67 99999-1234", "5567999991234"],
    ["5567999991234", "5567999991234"],
    ["67 3333-1234", "556733331234"],
    ["55 99999-1234", "5555999991234"], // DDD 55 (RS)
    ["0055 67 99999-1234", "5567999991234"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeBrPhone(input)).toBe(expected);
  });
  it.each(["123", "", "abc", "1234567890123456"])("rejeita %s", (input) => {
    expect(normalizeBrPhone(input)).toBeNull();
  });
});

describe("formatBrPhone", () => {
  it("formata celular e fixo", () => {
    expect(formatBrPhone("5567999991234")).toBe("(67) 99999-1234");
    expect(formatBrPhone("556733331234")).toBe("(67) 3333-1234");
  });
});
