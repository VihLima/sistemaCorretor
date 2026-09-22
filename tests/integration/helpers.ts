import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { signup } from "@/server/services/accounts";

export async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "AnalyticsEvent","LeadStatusHistory","LeadNote","LeadAnswer","Lead","QuestionOption","Question","Questionnaire","PropertyImage","Property","Session","User","Account" CASCADE`,
  );
}

let counter = 0;

export async function makeAgent(opts: { name?: string; whatsapp?: string | null } = {}): Promise<Ctx> {
  counter++;
  const ctx = await signup({
    name: opts.name ?? `Corretor ${counter}`,
    email: `corretor${counter}-${Date.now()}@teste.com`,
    password: "senha-segura-123",
  });
  if (opts.whatsapp !== null) {
    await db.user.update({ where: { id: ctx.userId }, data: { whatsapp: opts.whatsapp ?? "5567999990000" } });
  }
  return ctx;
}
