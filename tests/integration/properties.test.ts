import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import {
  addPropertyImage, createProperty, deleteProperty, getProperty, getPublicPropertyBySlug, listProperties,
  removePropertyImage, reorderPropertyImages, setPropertyStatus, updateProperty,
} from "@/server/services/properties";
import { PNG_1PX } from "../fixtures/images";
import { makeAgent, makePublishedProperty, propertyInput } from "./helpers";

describe("createProperty", () => {
  it("cria rascunho com slug a partir do título", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    expect(p).toMatchObject({ status: "DRAFT", slug: "casa-no-jardim-dos-estados", agentId: ctx.userId, price: 850000 });
    const p2 = await createProperty(ctx, propertyInput());
    expect(p2.slug).toBe("casa-no-jardim-dos-estados-2");
  });

  it("interpreta valores em formato brasileiro e listas", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput({ price: "1.250.000,00", condoFee: "", builtArea: "180,5", highlights: "Piscina\n\nChurrasqueira\n", showAddress: "on" }));
    expect(p).toMatchObject({ price: 1250000, condoFee: null, builtArea: 180.5, highlights: ["Piscina", "Churrasqueira"], showAddress: true });
  });

  it("valida campos obrigatórios", async () => {
    const ctx = await makeAgent();
    const err = await createProperty(ctx, propertyInput({ title: "", price: "" })).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(Object.keys(err.fieldErrors)).toEqual(expect.arrayContaining(["title", "price"]));
  });
});

describe("publicação", () => {
  it("exige foto e WhatsApp do corretor", async () => {
    const noWhats = await makeAgent({ whatsapp: null });
    const p = await createProperty(noWhats, propertyInput());
    await addPropertyImage(noWhats, p.id, { data: PNG_1PX });
    await expect(setPropertyStatus(noWhats, p.id, "PUBLISHED")).rejects.toThrow(/WhatsApp/);

    const ctx = await makeAgent();
    const p2 = await createProperty(ctx, propertyInput());
    await expect(setPropertyStatus(ctx, p2.id, "PUBLISHED")).rejects.toThrow(/foto/);
  });

  it("publica, registra data e aparece na página pública", async () => {
    const ctx = await makeAgent({ name: "Ana Martins" });
    const p = await makePublishedProperty(ctx);
    expect(p.publishedAt).toBeInstanceOf(Date);
    const pub = await getPublicPropertyBySlug(p.slug);
    expect(pub?.agent.name).toBe("Ana Martins");
    expect(pub?.images).toHaveLength(1);
  });

  it("não expõe rascunho nem pausado; vendido continua visível", async () => {
    const ctx = await makeAgent();
    const draft = await createProperty(ctx, propertyInput({ title: "Rascunho qualquer" }));
    expect(await getPublicPropertyBySlug(draft.slug)).toBeNull();
    const p = await makePublishedProperty(ctx);
    await setPropertyStatus(ctx, p.id, "PAUSED");
    expect(await getPublicPropertyBySlug(p.slug)).toBeNull();
    await setPropertyStatus(ctx, p.id, "SOLD");
    expect((await getPublicPropertyBySlug(p.slug))?.status).toBe("SOLD");
  });
});

describe("fotos", () => {
  it("rejeita arquivo que não é imagem", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    await expect(addPropertyImage(ctx, p.id, { data: Buffer.from("<svg/>") })).rejects.toBeInstanceOf(ValidationError);
  });

  it("adiciona, reordena e remove renumerando posições", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    const a = await addPropertyImage(ctx, p.id, { data: PNG_1PX });
    const b = await addPropertyImage(ctx, p.id, { data: PNG_1PX });
    const c = await addPropertyImage(ctx, p.id, { data: PNG_1PX });
    await reorderPropertyImages(ctx, p.id, [c.id, a.id, b.id]);
    expect((await getProperty(ctx, p.id)).images.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
    await removePropertyImage(ctx, c.id);
    const imgs = (await getProperty(ctx, p.id)).images;
    expect(imgs.map((i) => [i.id, i.position])).toEqual([[a.id, 0], [b.id, 1]]);
    await expect(reorderPropertyImages(ctx, p.id, [a.id])).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("regras de publicação", () => {
  it("recusa situação inválida", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    await expect(setPropertyStatus(ctx, p.id, "DELETED")).rejects.toBeInstanceOf(ValidationError);
    await expect(setPropertyStatus(ctx, p.id, undefined)).rejects.toBeInstanceOf(ValidationError);
    expect((await getProperty(ctx, p.id)).status).toBe("DRAFT");
  });

  it("não remove a última foto de imóvel publicado", async () => {
    const ctx = await makeAgent();
    const p = await makePublishedProperty(ctx);
    const [only] = (await getProperty(ctx, p.id)).images;
    await expect(removePropertyImage(ctx, only.id)).rejects.toThrow(/pelo menos uma foto/);
    expect((await getProperty(ctx, p.id)).images).toHaveLength(1);
    await setPropertyStatus(ctx, p.id, "PAUSED");
    await removePropertyImage(ctx, only.id);
    expect((await getProperty(ctx, p.id)).images).toHaveLength(0);
  });
});

describe("exclusão", () => {
  it("bloqueia exclusão de imóvel com contatos", async () => {
    const ctx = await makeAgent();
    const p = await makePublishedProperty(ctx);
    await db.lead.create({
      data: { accountId: ctx.accountId, propertyId: p.id, publicToken: "t1", name: "X", phone: "5567999991111", consentAt: new Date(), consentText: "ok" },
    });
    await expect(deleteProperty(ctx, p.id)).rejects.toThrow(/contatos/);
  });
  it("exclui imóvel sem contatos", async () => {
    const ctx = await makeAgent();
    const p = await createProperty(ctx, propertyInput());
    await deleteProperty(ctx, p.id);
    await expect(getProperty(ctx, p.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("isolamento entre corretores", () => {
  it("corretor B não vê nem altera imóveis de A", async () => {
    const a = await makeAgent();
    const b = await makeAgent();
    const p = await createProperty(a, propertyInput());
    expect(await listProperties(b)).toHaveLength(0);
    await expect(getProperty(b, p.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateProperty(b, p.id, propertyInput({ title: "Invadido" }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(setPropertyStatus(b, p.id, "PAUSED")).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteProperty(b, p.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(addPropertyImage(b, p.id, { data: PNG_1PX })).rejects.toBeInstanceOf(NotFoundError);
    const img = await addPropertyImage(a, p.id, { data: PNG_1PX });
    await expect(removePropertyImage(b, img.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getProperty(a, p.id)).title).toBe("Casa no Jardim dos Estados");
  });
});
