import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { signup } from "@/server/services/accounts";
import { addPropertyImage, createProperty, setPropertyStatus } from "@/server/services/properties";
import { PNG_1PX } from "../fixtures/images";

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

export function propertyInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Casa no Jardim dos Estados",
    type: "HOUSE",
    purpose: "SALE",
    price: "850.000",
    city: "Campo Grande",
    neighborhood: "Jardim dos Estados",
    bedrooms: "3",
    suites: "1",
    bathrooms: "2",
    parkingSpots: "2",
    description: "Casa térrea ampla, com quintal, área gourmet e ótima iluminação natural.",
    highlights: "Área gourmet\nQuintal",
    ...overrides,
  };
}

export async function makePublishedProperty(ctx: Ctx, overrides: Record<string, unknown> = {}) {
  const p = await createProperty(ctx, propertyInput(overrides));
  await addPropertyImage(ctx, p.id, { data: PNG_1PX });
  return setPropertyStatus(ctx, p.id, "PUBLISHED");
}

export async function makeLead(ctx: Ctx, propertyId: string, overrides: Partial<Prisma.LeadUncheckedCreateInput> = {}) {
  return db.lead.create({
    data: {
      accountId: ctx.accountId, propertyId, publicToken: randomUUID(), name: "Lead Teste",
      phone: "5567911112222", consentAt: new Date(), consentText: "ok", isComplete: true,
      classification: "MEDIUM", channel: "DIRECT", ...overrides,
    },
  });
}
