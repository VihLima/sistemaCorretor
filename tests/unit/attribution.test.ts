import { describe, expect, it } from "vitest";
import { resolveAttribution } from "@/domain/attribution";

describe("resolveAttribution", () => {
  it.each([
    [{ utmSource: "instagram" }, "INSTAGRAM"],
    [{ utmSource: "IG" }, "INSTAGRAM"],
    [{ utmSource: "facebook", utmMedium: "paid" }, "FACEBOOK"],
    [{ utmSource: "qrcode" }, "QR_CODE"],
    [{ utmSource: "google" }, "GOOGLE"],
    [{ gclid: "abc" }, "GOOGLE"],
    [{ fbclid: "abc" }, "FACEBOOK"],
    [{ fbclid: "abc", referrer: "https://l.instagram.com/" }, "INSTAGRAM"],
    [{ referrer: "https://www.instagram.com/" }, "INSTAGRAM"],
    [{ referrer: "https://m.facebook.com/" }, "FACEBOOK"],
    [{ referrer: "https://www.google.com.br/" }, "GOOGLE"],
    [{ referrer: "https://exemplo.com/" }, "OTHER"],
    [{ utmSource: "newsletter" }, "OTHER"],
    [{}, "DIRECT"],
  ] as const)("%o → %s", (input, channel) => {
    expect(resolveAttribution(input).channel).toBe(channel);
  });

  it("trata o próprio site como acesso direto e descarta o referrer", () => {
    const r = resolveAttribution({ referrer: "https://app.exemplo.com/imovel/x", ownHost: "app.exemplo.com" });
    expect(r).toMatchObject({ channel: "DIRECT", referrer: null });
  });

  it("preserva UTMs aparados e limitados", () => {
    const r = resolveAttribution({ utmSource: " instagram ", utmCampaign: "c".repeat(300) });
    expect(r.utmSource).toBe("instagram");
    expect(r.utmCampaign).toHaveLength(200);
    expect(r.utmMedium).toBeNull();
  });
});
