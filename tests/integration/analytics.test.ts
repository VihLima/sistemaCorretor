import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getDashboard } from "@/server/services/analytics";
import { makeAgent, makeLead, makePublishedProperty } from "./helpers";

describe("getDashboard", () => {
  it("calcula totais, taxas e origens apenas da própria conta", async () => {
    const ctx = await makeAgent();
    const p = await makePublishedProperty(ctx);
    const view = (visitorId: string) => ({ accountId: ctx.accountId, propertyId: p.id, type: "PAGE_VIEW" as const, visitorId });
    await db.analyticsEvent.createMany({ data: [view("v1"), view("v1"), view("v2"), view("v3"), view("v4")] });
    await db.analyticsEvent.create({ data: { accountId: ctx.accountId, propertyId: p.id, type: "QUESTIONNAIRE_START", visitorId: "v1" } });
    await makeLead(ctx, p.id, { classification: "HIGH", channel: "INSTAGRAM", wantsVisit: true, whatsappClickedAt: new Date() });
    await makeLead(ctx, p.id, { classification: "LOW", channel: "INSTAGRAM", status: "CONTACTED" });
    await makeLead(ctx, p.id, { classification: "UNRATED", channel: "GOOGLE", isComplete: false });
    await makeLead(ctx, p.id, { name: "Antigo", createdAt: new Date(Date.now() - 60 * 864e5) });

    const other = await makeAgent();
    const op = await makePublishedProperty(other);
    await makeLead(other, op.id, { classification: "HIGH" });

    const d = await getDashboard(ctx, 30);
    expect(d.properties).toEqual({ total: 1, published: 1 });
    expect(d.views).toBe(5);
    expect(d.uniqueVisitors).toBe(4);
    expect(d.questionnaireStarts).toBe(1);
    expect(d.leads).toBe(3);
    expect(d.completeLeads).toBe(2);
    expect(d.highIntent).toBe(1);
    expect(d.pendingNew).toBe(3); // status NEW em qualquer período (inclui o antigo)
    expect(d.wantsVisit).toBe(1);
    expect(d.whatsappClicks).toBe(1);
    expect(d.rates.visitorToLead).toBe(0.75);
    expect(d.rates.completion).toBeCloseTo(2 / 3);
    expect(d.rates.leadToWhatsapp).toBe(0.5);
    expect(d.byChannel).toEqual([{ channel: "INSTAGRAM", count: 2 }, { channel: "GOOGLE", count: 1 }]);
    expect(d.recentHighIntent).toHaveLength(1);
  });

  it("retorna zeros e taxas nulas sem dados", async () => {
    const ctx = await makeAgent();
    const d = await getDashboard(ctx, 7);
    expect(d.leads).toBe(0);
    expect(d.rates.visitorToLead).toBeNull();
    expect(d.byChannel).toEqual([]);
  });
});
