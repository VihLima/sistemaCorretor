import { describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/server/errors";
import { getProfile, updateProfile, updateProfilePhoto } from "@/server/services/profile";
import { setPropertyStatus } from "@/server/services/properties";
import { PNG_1PX } from "../fixtures/images";
import { makeAgent, makePublishedProperty } from "./helpers";

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
  it("não remove o WhatsApp enquanto houver imóvel publicado", async () => {
    const ctx = await makeAgent();
    const p = await makePublishedProperty(ctx);
    const err = await updateProfile(ctx, { name: "Ana", whatsapp: "" }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fieldErrors.whatsapp).toMatch(/Pause ou arquive/);
    expect((await getProfile(ctx)).whatsapp).toBe("5567999990000");

    await setPropertyStatus(ctx, p.id, "PAUSED");
    await updateProfile(ctx, { name: "Ana", whatsapp: "" });
    expect((await getProfile(ctx)).whatsapp).toBeNull();
  });

  it("salva foto", async () => {
    const ctx = await makeAgent();
    await updateProfilePhoto(ctx, { data: PNG_1PX });
    expect((await getProfile(ctx)).photoUrl).toMatch(/^memory:\/\//);
  });

  it("isola contas: ctx forjado de outra conta não acessa nem altera o perfil", async () => {
    const a = await makeAgent({ name: "Ana" });
    const b = await makeAgent({ name: "Bia" });
    const before = await getProfile(a);
    const forged = { accountId: b.accountId, userId: a.userId };

    await expect(getProfile(forged)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateProfile(forged, { name: "Hackeada" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateProfilePhoto(forged, { data: PNG_1PX })).rejects.toBeInstanceOf(NotFoundError);

    expect(await getProfile(a)).toEqual(before);
  });
});
