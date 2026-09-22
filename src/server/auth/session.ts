import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";
import type { Ctx } from "@/server/context";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = Ctx & { name: string; email: string };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const { user } = session;
  return { userId: user.id, accountId: user.accountId, name: user.name, email: user.email };
}

export async function deleteSession(token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}
