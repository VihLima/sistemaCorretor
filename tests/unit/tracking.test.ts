import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureAttribution, getAttribution, getVisitorId, randomId } from "@/lib/tracking";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const ORIGIN = "https://corretor.app";

function visit(path: string, referrer = "") {
  vi.stubGlobal("window", { location: { search: new URL(path, ORIGIN).search, origin: ORIGIN } });
  vi.stubGlobal("document", { referrer });
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", new MemoryStorage());
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("captureAttribution", () => {
  it("stores utm and external referrer on landing", () => {
    visit("/imovel/casa?utm_source=instagram&utm_campaign=teste&fbclid=abc", "https://l.instagram.com/");
    const a = captureAttribution();
    expect(a).toMatchObject({ utmSource: "instagram", utmCampaign: "teste", fbclid: "abc", referrer: "https://l.instagram.com/" });
    expect(getAttribution()).toEqual(a);
  });

  it("keeps stored utms when only the same external referrer is present (client-side navigation)", () => {
    visit("/imovel/casa?utm_source=instagram&utm_campaign=teste", "https://l.instagram.com/");
    captureAttribution();
    visit("/imovel/casa/interesse", "https://l.instagram.com/");
    const a = captureAttribution();
    expect(a).toMatchObject({ utmSource: "instagram", utmCampaign: "teste", referrer: "https://l.instagram.com/" });
  });

  it("overwrites with a new campaign", () => {
    visit("/imovel/casa?utm_source=instagram");
    captureAttribution();
    visit("/imovel/casa?utm_source=google&utm_medium=cpc&gclid=xyz");
    const a = captureAttribution();
    expect(a).toMatchObject({ utmSource: "google", utmMedium: "cpc", gclid: "xyz" });
    expect(a.utmCampaign).toBeUndefined();
    expect(getAttribution().utmSource).toBe("google");
  });

  it("stores an empty (direct) attribution on a first visit without signals", () => {
    visit("/imovel/casa");
    const a = captureAttribution();
    expect(Object.values(a).filter(Boolean)).toHaveLength(0);
    expect(sessionStorage.getItem("sc_attr")).not.toBeNull();
  });

  it("stores an external referrer alone only when nothing is stored yet", () => {
    visit("/imovel/casa", "https://www.google.com/");
    expect(captureAttribution().referrer).toBe("https://www.google.com/");
    visit("/imovel/casa", "https://www.bing.com/");
    expect(captureAttribution().referrer).toBe("https://www.google.com/");
  });

  it("ignores same-origin referrers", () => {
    visit("/imovel/casa", `${ORIGIN}/outra`);
    expect(captureAttribution().referrer).toBeUndefined();
  });
});

describe("visitor id", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("falls back to getRandomValues when randomUUID is unavailable (http on LAN)", () => {
    const getRandomValues = vi.fn((b: Uint8Array) => {
      b.forEach((_, i) => (b[i] = (i * 37) % 256));
      return b;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    expect(randomId()).toMatch(UUID);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("falls back to Math.random without Web Crypto", () => {
    vi.stubGlobal("crypto", undefined);
    expect(randomId()).toMatch(UUID);
  });

  it("persists the generated id", () => {
    vi.stubGlobal("crypto", {});
    const id = getVisitorId();
    expect(id).toMatch(UUID);
    expect(getVisitorId()).toBe(id);
  });
});
