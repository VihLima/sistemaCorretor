import { loginSchema, signupSchema } from "@/lib/validation/auth";
import { parseOrThrow } from "@/lib/validation/parse";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { createDefaultQuestionnaire } from "./questionnaires";

const EMAIL_TAKEN = { email: "Este e-mail já está cadastrado" };
let dummyHash: Promise<string> | null = null;

export async function signup(input: unknown): Promise<Ctx> {
  const data = parseOrThrow(signupSchema, input);
  if (await db.user.findUnique({ where: { email: data.email } })) throw new ValidationError(EMAIL_TAKEN);
  const passwordHash = await hashPassword(data.password);
  try {
    return await db.$transaction(async (tx) => {
      const account = await tx.account.create({ data: { name: data.name } });
      const user = await tx.user.create({
        data: { accountId: account.id, name: data.name, email: data.email, passwordHash },
      });
      await createDefaultQuestionnaire(tx, account.id);
      return { accountId: account.id, userId: user.id };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ValidationError(EMAIL_TAKEN);
    throw e;
  }
}

export async function authenticate(input: unknown): Promise<Ctx | null> {
  const data = parseOrThrow(loginSchema, input);
  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user) {
    // mantém tempo de resposta semelhante para não revelar e-mails cadastrados
    await verifyPassword(data.password, await (dummyHash ??= hashPassword("dummy-password")));
    return null;
  }
  if (!(await verifyPassword(data.password, user.passwordHash))) return null;
  return { accountId: user.accountId, userId: user.id };
}
