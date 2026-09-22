import { describe, expect, it } from "vitest";
import { createSession, deleteExpiredSessions, deleteSession, getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";
import { authenticate, signup } from "@/server/services/accounts";

const valid = { name: "Ana Martins", email: "Ana@Exemplo.com", password: "senha-segura-123" };

describe("signup", () => {
  it("cria conta, usuário e questionário padrão", async () => {
    const ctx = await signup(valid);
    const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId } });
    expect(user.email).toBe("ana@exemplo.com");
    expect(user.passwordHash).not.toContain("senha");
    const qn = await db.questionnaire.findFirstOrThrow({
      where: { accountId: ctx.accountId, isDefault: true },
      include: { questions: { orderBy: { position: "asc" }, include: { options: true } } },
    });
    expect(qn.questions).toHaveLength(5);
    expect(qn.questions[4].isVisitIntent).toBe(true);
  });

  it("recusa e-mail duplicado", async () => {
    await signup(valid);
    await expect(signup({ ...valid, email: "ana@exemplo.com" })).rejects.toMatchObject({
      fieldErrors: { email: "Este e-mail já está cadastrado" },
    });
  });

  it("recusa senha curta", async () => {
    await expect(signup({ ...valid, password: "123" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("authenticate", () => {
  it("aceita credenciais corretas sem diferenciar maiúsculas no e-mail", async () => {
    const ctx = await signup(valid);
    expect(await authenticate({ email: "ANA@exemplo.com", password: valid.password })).toEqual(ctx);
  });
  it("recusa senha errada e e-mail desconhecido", async () => {
    await signup(valid);
    expect(await authenticate({ email: valid.email, password: "errada-123" })).toBeNull();
    expect(await authenticate({ email: "x@y.com", password: "qualquer-123" })).toBeNull();
  });
});

describe("sessões", () => {
  it("cria, lê e remove sessão", async () => {
    const ctx = await signup(valid);
    const { token } = await createSession(ctx.userId);
    expect(await getSessionUser(token)).toMatchObject({ ...ctx, name: "Ana Martins" });
    const stored = await db.session.findFirstOrThrow();
    expect(stored.id).not.toBe(token);
    await deleteSession(token);
    expect(await getSessionUser(token)).toBeNull();
  });
  it("ignora sessão expirada ou token inválido", async () => {
    const ctx = await signup(valid);
    const { token } = await createSession(ctx.userId);
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getSessionUser(token)).toBeNull();
    expect(await getSessionUser("inexistente")).toBeNull();
    expect(await getSessionUser(undefined)).toBeNull();
  });
  it("limpa apenas sessões vencidas", async () => {
    const ctx = await signup(valid);
    const expired = await createSession(ctx.userId);
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const { token } = await createSession(ctx.userId);
    await deleteExpiredSessions();
    expect(await db.session.count()).toBe(1);
    expect(await getSessionUser(token)).not.toBeNull();
    expect(await getSessionUser(expired.token)).toBeNull();
  });
});
