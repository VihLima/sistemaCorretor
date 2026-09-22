import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/server/rate-limit";

describe("checkRateLimit", () => {
  it("bloqueia após o limite e libera após a janela", () => {
    const key = `k-${Math.random()}`;
    expect(checkRateLimit(key, 2, 1000, 0)).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 10)).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 20)).toBe(false);
    expect(checkRateLimit(key, 2, 1000, 1001)).toBe(true);
  });
});
