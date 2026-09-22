import { describe, expect, it } from "vitest";
import { getProfile, updateProfile, updateProfilePhoto } from "@/server/services/profile";
import { PNG_1PX } from "../fixtures/images";
import { makeAgent } from "./helpers";

describe("perfil", () => {
  it("normaliza WhatsApp e Instagram", async () => {
    const ctx = await makeAgent({ whatsapp: null });
    await updateProfile(ctx, { name: "Ana", whatsapp: "(67) 99999-1234", instagramUrl: "@ana.imoveis", creci: "12345-F" });
    const p = await getProfile(ctx);
    expect(p.whatsapp).toBe("5567999991234");
    expect(p.instagramUrl).toBe("https://instagram.com/ana.imoveis");
  });
  it("recusa WhatsApp inválido", async () => {
    const ctx = await makeAgent();
    await expect(updateProfile(ctx, { name: "Ana", whatsapp: "123" })).rejects.toMatchObject({
      fieldErrors: { whatsapp: expect.any(String) },
    });
  });
  it("salva foto", async () => {
    const ctx = await makeAgent();
    await updateProfilePhoto(ctx, { data: PNG_1PX });
    expect((await getProfile(ctx)).photoUrl).toMatch(/^memory:\/\//);
  });
});
