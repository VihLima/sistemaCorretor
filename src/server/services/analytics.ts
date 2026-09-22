import { rate } from "@/domain/format";
import type { Channel } from "@/domain/types";
import type { Ctx } from "@/server/context";
import { db } from "@/server/db";

export async function getDashboard(ctx: Ctx, days = 30) {
  const { accountId } = ctx;
  const since = new Date(Date.now() - days * 864e5);
  const period = { accountId, createdAt: { gte: since } };

  const [total, published, views, visitors, starts, leads, completeLeads, highIntent, pendingNew, wantsVisit, whatsappClicks, byChannel, recentHighIntent] =
    await Promise.all([
      db.property.count({ where: { accountId } }),
      db.property.count({ where: { accountId, status: "PUBLISHED" } }),
      db.analyticsEvent.count({ where: { ...period, type: "PAGE_VIEW" } }),
      // Cast the enum column to compare with a text literal in raw SQL, since Postgres
      // does not implicitly cast text to a custom enum type.
      db.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT "visitorId")::int AS count FROM "AnalyticsEvent"
        WHERE "accountId" = ${accountId} AND "type" = 'PAGE_VIEW'::"AnalyticsEventType" AND "createdAt" >= ${since}`,
      db.analyticsEvent.count({ where: { ...period, type: "QUESTIONNAIRE_START" } }),
      db.lead.count({ where: period }),
      db.lead.count({ where: { ...period, isComplete: true } }),
      db.lead.count({ where: { ...period, classification: "HIGH" } }),
      db.lead.count({ where: { accountId, status: "NEW" } }),
      db.lead.count({ where: { ...period, wantsVisit: true } }),
      db.lead.count({ where: { ...period, whatsappClickedAt: { not: null } } }),
      db.lead.groupBy({ by: ["channel"], where: period, _count: { _all: true } }),
      db.lead.findMany({
        where: { accountId, classification: "HIGH" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { property: { select: { title: true } } },
      }),
    ]);

  const uniqueVisitors = visitors[0]?.count ?? 0;
  return {
    days,
    properties: { total, published },
    views,
    uniqueVisitors,
    questionnaireStarts: starts,
    leads,
    completeLeads,
    highIntent,
    pendingNew,
    wantsVisit,
    whatsappClicks,
    rates: {
      visitorToLead: rate(leads, uniqueVisitors),
      completion: rate(completeLeads, leads),
      leadToWhatsapp: rate(whatsappClicks, completeLeads),
    },
    byChannel: byChannel
      .map((c) => ({ channel: c.channel as Channel, count: c._count._all }))
      .sort((a, b) => b.count - a.count),
    recentHighIntent,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
