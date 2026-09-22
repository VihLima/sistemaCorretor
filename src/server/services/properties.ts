import { randomUUID } from "node:crypto";
import { z } from "zod";
import { slugify, uniqueSlug } from "@/domain/slug";
import { PROPERTY_STATUSES } from "@/domain/types";
import { parseOrThrow } from "@/lib/validation/parse";
import { propertySchema } from "@/lib/validation/property";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { getStorage } from "@/server/storage";
import { sniffImageType } from "@/server/storage/sniff";
import { MAX_IMAGE_BYTES } from "./profile";

export const MAX_IMAGES = 20;
const imagesOrdered = { orderBy: { position: "asc" as const } };
const statusSchema = z.enum(PROPERTY_STATUSES, "Situação inválida");

export async function listProperties(ctx: Ctx) {
  return db.property.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { updatedAt: "desc" },
    include: { images: { ...imagesOrdered, take: 1 }, _count: { select: { leads: true } } },
  });
}

export async function getProperty(ctx: Ctx, id: string) {
  const property = await db.property.findFirst({
    where: { id, accountId: ctx.accountId },
    include: { images: imagesOrdered },
  });
  if (!property) throw new NotFoundError("Imóvel");
  return property;
}

export async function createProperty(ctx: Ctx, input: unknown) {
  const data = parseOrThrow(propertySchema, input);
  const slug = await uniqueSlug(slugify(data.title), async (s) =>
    Boolean(await db.property.findUnique({ where: { slug: s }, select: { id: true } })),
  );
  return db.property.create({ data: { ...data, slug, accountId: ctx.accountId, agentId: ctx.userId } });
}

/** O slug não muda na edição para não quebrar links e QR Codes já divulgados. */
export async function updateProperty(ctx: Ctx, id: string, input: unknown) {
  await getProperty(ctx, id);
  const data = parseOrThrow(propertySchema, input);
  return db.property.update({ where: { id }, data });
}

export async function setPropertyStatus(ctx: Ctx, id: string, input: unknown) {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ status: "Situação inválida" }, "Situação inválida");
  const status = parsed.data;
  const property = await getProperty(ctx, id);
  if (status === "PUBLISHED") {
    const agent = await db.user.findUniqueOrThrow({ where: { id: property.agentId } });
    if (!agent.whatsapp) {
      const msg = "Cadastre seu WhatsApp no perfil antes de publicar.";
      throw new ValidationError({ _form: msg }, msg);
    }
    if (property.images.length === 0) {
      const msg = "Adicione pelo menos uma foto antes de publicar.";
      throw new ValidationError({ _form: msg }, msg);
    }
  }
  return db.property.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? (property.publishedAt ?? new Date()) : property.publishedAt },
  });
}

export async function deleteProperty(ctx: Ctx, id: string) {
  const property = await getProperty(ctx, id);
  if (await db.lead.count({ where: { propertyId: id } })) {
    throw new ConflictError("Este imóvel possui contatos. Marque como vendido, alugado ou pausado em vez de excluir.");
  }
  await db.property.delete({ where: { id } });
  await Promise.all(property.images.map((img) => getStorage().delete(img.storageKey).catch(() => {})));
}

export async function addPropertyImage(ctx: Ctx, propertyId: string, file: { data: Buffer }) {
  const property = await getProperty(ctx, propertyId);
  const type = sniffImageType(file.data);
  if (!type) throw new ValidationError({ file: "Envie imagens JPG, PNG ou WebP" });
  if (file.data.byteLength > MAX_IMAGE_BYTES) throw new ValidationError({ file: "Imagem muito grande (máx. 5 MB)" });
  if (property.images.length >= MAX_IMAGES) throw new ValidationError({ file: `Limite de ${MAX_IMAGES} fotos por imóvel` });
  const key = `${ctx.accountId}/${propertyId}/${randomUUID()}.${type.ext}`;
  const { url } = await getStorage().put(key, file.data, type.contentType);
  const last = property.images.at(-1);
  return db.propertyImage.create({
    data: { propertyId, url, storageKey: key, position: last ? last.position + 1 : 0 },
  });
}

export async function removePropertyImage(ctx: Ctx, imageId: string) {
  const image = await db.propertyImage.findFirst({ where: { id: imageId, property: { accountId: ctx.accountId } } });
  if (!image) throw new NotFoundError("Foto");
  const property = await db.property.findUniqueOrThrow({ where: { id: image.propertyId }, include: { _count: { select: { images: true } } } });
  if (property.status === "PUBLISHED" && property._count.images <= 1) {
    const msg = "Um imóvel publicado precisa de pelo menos uma foto. Pause-o antes de remover a última.";
    throw new ValidationError({ _form: msg }, msg);
  }
  await db.propertyImage.delete({ where: { id: imageId } });
  const remaining = await db.propertyImage.findMany({ where: { propertyId: image.propertyId }, ...imagesOrdered });
  await db.$transaction(remaining.map((img, i) => db.propertyImage.update({ where: { id: img.id }, data: { position: i } })));
  await getStorage().delete(image.storageKey).catch(() => {});
}

export async function reorderPropertyImages(ctx: Ctx, propertyId: string, orderedIds: string[]) {
  const property = await getProperty(ctx, propertyId);
  const current = new Set(property.images.map((i) => i.id));
  if (orderedIds.length !== current.size || !orderedIds.every((id) => current.has(id))) {
    throw new ValidationError({ images: "Lista de fotos desatualizada. Recarregue a página." });
  }
  await db.$transaction(orderedIds.map((id, i) => db.propertyImage.update({ where: { id }, data: { position: i } })));
}

export async function getPublicPropertyBySlug(slug: string) {
  return db.property.findFirst({
    where: { slug, status: { in: ["PUBLISHED", "SOLD", "RENTED"] }, publishedAt: { not: null } },
    include: {
      images: imagesOrdered,
      agent: { select: { name: true, photoUrl: true, creci: true, whatsapp: true, agencyName: true, bio: true, instagramUrl: true } },
    },
  });
}
