import { randomUUID } from "node:crypto";
import { parseOrThrow } from "@/lib/validation/parse";
import { profileSchema } from "@/lib/validation/profile";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { getStorage } from "@/server/storage";
import { sniffImageType } from "@/server/storage/sniff";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function getProfile(ctx: Ctx) {
  const user = await db.user.findFirst({ where: { id: ctx.userId, accountId: ctx.accountId } });
  if (!user) throw new NotFoundError("Usuário");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _omit, ...profile } = user;
  return profile;
}

export async function updateProfile(ctx: Ctx, input: unknown) {
  const data = parseOrThrow(profileSchema, input);
  await getProfile(ctx);
  await db.user.update({ where: { id: ctx.userId, accountId: ctx.accountId }, data });
}

export async function updateProfilePhoto(ctx: Ctx, file: { data: Buffer }) {
  const current = await getProfile(ctx);
  const type = sniffImageType(file.data);
  if (!type) throw new ValidationError({ photo: "Envie uma imagem JPG, PNG ou WebP" });
  if (file.data.byteLength > MAX_IMAGE_BYTES) throw new ValidationError({ photo: "Imagem muito grande (máx. 5 MB)" });
  const key = `${ctx.accountId}/profile/${randomUUID()}.${type.ext}`;
  const { url } = await getStorage().put(key, file.data, type.contentType);
  await db.user.update({ where: { id: ctx.userId, accountId: ctx.accountId }, data: { photoUrl: url, photoKey: key } });
  if (current.photoKey) await getStorage().delete(current.photoKey).catch(() => {});
}
