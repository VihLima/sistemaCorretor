import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { addLeadNote, deleteLead, getLead, listLeads, updateLeadStatus } from "@/server/services/leads";
import { makeAgent, makeLead, makePublishedProperty } from "./helpers";

async function fixture() {
  const ctx = await makeAgent();
  const p1 = await makePublishedProperty(ctx);
  const p2 = await makePublishedProperty(ctx, { title: "Apartamento no Centro" });
  await makeLead(ctx, p1.id, { name: "Maria Souza", classification: "HIGH", channel: "INSTAGRAM", phone: "5567900001111" });
  await makeLead(ctx, p1.id, { name: "Carlos Lima", classification: "LOW", channel: "GOOGLE", status: "CONTACTED" });
  await makeLead(ctx, p2.id, { name: "Beatriz", classification: "HIGH", channel: "QR_CODE", isComplete: false });
  return { ctx, p1, p2 };
}

describe("listLeads", () => {
  it("filtra por imóvel, classificação, status, origem e completude", async () => {
    const { ctx, p1, p2 } = await fixture();
    expect((await listLeads(ctx, {})).total).toBe(3);
    expect((await listLeads(ctx, { propertyId: p2.id })).items.map((l) => l.name)).toEqual(["Beatriz"]);
    expect((await listLeads(ctx, { classification: "HIGH" })).total).toBe(2);
    expect((await listLeads(ctx, { status: "CONTACTED" })).items[0].name).toBe("Carlos Lima");
    expect((await listLeads(ctx, { channel: "INSTAGRAM", propertyId: p1.id })).total).toBe(1);
    expect((await listLeads(ctx, { complete: "no" })).items[0].name).toBe("Beatriz");
    expect((await listLeads(ctx, { classification: "", status: "" })).total).toBe(3);
  });

  it("busca por nome e telefone", async () => {
    const { ctx } = await fixture();
    expect((await listLeads(ctx, { q: "maria" })).items[0].name).toBe("Maria Souza");
    expect((await listLeads(ctx, { q: "0000-1111" })).items[0].name).toBe("Maria Souza");
  });

  it("filtra por período", async () => {
    const { ctx, p1 } = await fixture();
    await makeLead(ctx, p1.id, { name: "Antigo", createdAt: new Date(Date.now() - 40 * 864e5) });
    expect((await listLeads(ctx, { days: "30" })).total).toBe(3);
  });
});

describe("gestão do lead", () => {
  it("altera status com histórico e adiciona observação", async () => {
    const { ctx, p1 } = await fixture();
    const lead = await makeLead(ctx, p1.id);
    await updateLeadStatus(ctx, lead.id, "VISIT_SCHEDULED");
    await addLeadNote(ctx, lead.id, "Visita sábado às 10h");
    const full = await getLead(ctx, lead.id);
    expect(full.status).toBe("VISIT_SCHEDULED");
    expect(full.history.at(-1)).toMatchObject({ fromStatus: "NEW", toStatus: "VISIT_SCHEDULED", changedById: ctx.userId });
    expect(full.notes[0].body).toBe("Visita sábado às 10h");
    await expect(addLeadNote(ctx, lead.id, "   ")).rejects.toBeInstanceOf(ValidationError);
    await expect(updateLeadStatus(ctx, lead.id, "XYZ" as never)).rejects.toBeInstanceOf(ValidationError);
  });

  it("exclui lead e dados relacionados", async () => {
    const { ctx, p1 } = await fixture();
    const lead = await makeLead(ctx, p1.id);
    await addLeadNote(ctx, lead.id, "nota");
    await deleteLead(ctx, lead.id);
    expect(await db.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    expect(await db.leadNote.count({ where: { leadId: lead.id } })).toBe(0);
  });
});

describe("isolamento", () => {
  it("corretor B não acessa leads de A", async () => {
    const { ctx: a, p1 } = await fixture();
    const b = await makeAgent();
    const lead = await makeLead(a, p1.id);
    expect((await listLeads(b, {})).total).toBe(0);
    expect((await listLeads(b, { propertyId: p1.id })).total).toBe(0);
    await expect(getLead(b, lead.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateLeadStatus(b, lead.id, "LOST")).rejects.toBeInstanceOf(NotFoundError);
    await expect(addLeadNote(b, lead.id, "x")).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteLead(b, lead.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
