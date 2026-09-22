import { z } from "zod";
import { LEAD_STATUSES, type LeadStatus } from "@/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import { leadFiltersSchema } from "@/lib/validation/lead-filters";
import { parseOrThrow } from "@/lib/validation/parse";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

export const LEADS_PAGE_SIZE = 25;
export type { LeadFilters } from "@/lib/validation/lead-filters";

export async function listLeads(ctx: Ctx, input: unknown) {
  const f = parseOrThrow(leadFiltersSchema, input);
  const where: Prisma.LeadWhereInput = {
    accountId: ctx.accountId,
    propertyId: f.propertyId,
    classification: f.classification,
    status: f.status,
    channel: f.channel,
    isComplete: f.complete === undefined ? undefined : f.complete === "yes",
    createdAt: f.days ? { gte: new Date(Date.now() - f.days * 864e5) } : undefined,
  };
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ];
  }
  const [items, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * LEADS_PAGE_SIZE,
      take: LEADS_PAGE_SIZE,
      include: { property: { select: { id: true, title: true, slug: true } } },
    }),
    db.lead.count({ where }),
  ]);
  return { items, total, page: f.page, pageSize: LEADS_PAGE_SIZE };
}

export async function getLead(ctx: Ctx, id: string) {
  const lead = await db.lead.findFirst({
    where: { id, accountId: ctx.accountId },
    include: {
      property: { select: { id: true, title: true, slug: true } },
      answers: { orderBy: { position: "asc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      history: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
    },
  });
  if (!lead) throw new NotFoundError("Contato");
  return lead;
}

async function assertOwned(ctx: Ctx, id: string) {
  const lead = await db.lead.findFirst({ where: { id, accountId: ctx.accountId }, select: { id: true, status: true } });
  if (!lead) throw new NotFoundError("Contato");
  return lead;
}

export async function updateLeadStatus(ctx: Ctx, id: string, status: LeadStatus) {
  const next = parseOrThrow(z.enum(LEAD_STATUSES, "Status inválido"), status);
  const lead = await assertOwned(ctx, id);
  if (lead.status === next) return;
  await db.$transaction([
    db.lead.update({ where: { id }, data: { status: next } }),
    db.leadStatusHistory.create({ data: { leadId: id, fromStatus: lead.status, toStatus: next, changedById: ctx.userId } }),
  ]);
}

export async function addLeadNote(ctx: Ctx, id: string, body: string) {
  const text = parseOrThrow(z.string().trim().min(1, "Escreva a observação").max(2000), body);
  await assertOwned(ctx, id);
  await db.leadNote.create({ data: { leadId: id, authorId: ctx.userId, body: text } });
}

export async function deleteLead(ctx: Ctx, id: string) {
  await assertOwned(ctx, id);
  await db.lead.delete({ where: { id } });
}
