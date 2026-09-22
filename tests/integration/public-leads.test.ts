import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { createProperty } from "@/server/services/properties";
import {
  getPublicQuestions, recordPublicEvent, registerWhatsappClick, startLead, submitAnswers,
} from "@/server/services/public-leads";
import { getQuestionDefsForProperty } from "@/server/services/questionnaires";
import { makeAgent, makePublishedProperty, propertyInput } from "./helpers";

const appUrl = "https://app.teste";

async function setup() {
  const ctx = await makeAgent();
  const property = await makePublishedProperty(ctx);
  const questions = await getQuestionDefsForProperty(property.id, ctx.accountId);
  const answer = (qIndex: number, optIndex: number) => ({ [questions[qIndex].id]: { optionIds: [questions[qIndex].options[optIndex].id] } });
  const best = { ...answer(0, 0), ...answer(1, 0), ...answer(2, 0), ...answer(3, 0), ...answer(4, 0) };
  return { ctx, property, questions, answer, best };
}

const contact = (propertyId: string, extra: Record<string, unknown> = {}) => ({
  propertyId, name: "João Silva", phone: "(67) 98888-7777", consent: true, visitorId: "v1", ...extra,
});

describe("startLead", () => {
  it("cria lead incompleto com origem e telefone normalizado", async () => {
    const { ctx, property } = await setup();
    const { leadId, token } = await startLead(contact(property.id, { attribution: { utmSource: "instagram", utmCampaign: "casa" } }));
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead).toMatchObject({
      accountId: ctx.accountId, phone: "5567988887777", isComplete: false, classification: "UNRATED",
      channel: "INSTAGRAM", utmCampaign: "casa", status: "NEW", publicToken: token,
    });
    expect(lead.consentText).toMatch(/Política de Privacidade/);
  });

  it("recusa imóvel não publicado, sem consentimento ou telefone inválido", async () => {
    const ctx = await makeAgent();
    const draft = await createProperty(ctx, propertyInput());
    await expect(startLead(contact(draft.id))).rejects.toBeInstanceOf(NotFoundError);
    const { property } = await setup();
    await expect(startLead(contact(property.id, { consent: false }))).rejects.toMatchObject({ fieldErrors: { consent: expect.any(String) } });
    await expect(startLead(contact(property.id, { phone: "123" }))).rejects.toMatchObject({ fieldErrors: { phone: expect.any(String) } });
  });

  it("reaproveita lead incompleto do mesmo telefone no mesmo imóvel", async () => {
    const { property } = await setup();
    const first = await startLead(contact(property.id));
    const second = await startLead(contact(property.id, { name: "João S." }));
    expect(second.leadId).toBe(first.leadId);
    expect(await db.lead.count()).toBe(1);
  });
});

describe("submitAnswers", () => {
  it("pontua, salva respostas e gera link do WhatsApp", async () => {
    const { property, best } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    const handoff = await submitAnswers(leadId, token, { answers: best }, { appUrl });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { answers: { orderBy: { position: "asc" } } } });
    expect(lead).toMatchObject({ isComplete: true, score: 100, maxScore: 100, classification: "HIGH", wantsVisit: true });
    expect(lead.answers).toHaveLength(5);
    expect(lead.answers[1]).toMatchObject({ questionLabel: "Quando pretende fechar negócio?", displayValue: "Imediatamente", points: 30 });
    expect(handoff.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5567999990000\?text=/);
    expect(handoff.message).toContain("Olá, sou João Silva.");
    expect(handoff.message).toContain(`${appUrl}/imovel/${property.slug}`);
    expect(await db.analyticsEvent.count({ where: { type: "QUESTIONNAIRE_COMPLETE" } })).toBe(1);
  });

  it("valida obrigatórias e opções de outra pergunta", async () => {
    const { property, questions, answer } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    await expect(submitAnswers(leadId, token, { answers: answer(0, 0) }, { appUrl })).rejects.toBeInstanceOf(ValidationError);
    const wrong = { [questions[1].id]: { optionIds: [questions[2].options[0].id] } };
    await expect(submitAnswers(leadId, token, { answers: wrong }, { appUrl })).rejects.toBeInstanceOf(ValidationError);
  });

  it("exige o token do próprio lead", async () => {
    const { property, best } = await setup();
    const { leadId } = await startLead(contact(property.id));
    await expect(submitAnswers(leadId, "token-errado", { answers: best }, { appUrl })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reenvio após concluir devolve o mesmo resultado sem duplicar", async () => {
    const { property, best } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    await submitAnswers(leadId, token, { answers: best }, { appUrl });
    await submitAnswers(leadId, token, { answers: best }, { appUrl });
    expect(await db.leadAnswer.count()).toBe(5);
    expect(await db.analyticsEvent.count({ where: { type: "QUESTIONNAIRE_COMPLETE" } })).toBe(1);
  });

  it("recusa mais de 20 respostas", async () => {
    const { property } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    const answers = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`q${i}`, { text: "x" }]),
    );
    await expect(submitAnswers(leadId, token, { answers }, { appUrl })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("registerWhatsappClick", () => {
  it("registra uma única vez", async () => {
    const { property, best } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    await submitAnswers(leadId, token, { answers: best }, { appUrl });
    await registerWhatsappClick(leadId, token);
    await registerWhatsappClick(leadId, token);
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).whatsappClickedAt).toBeInstanceOf(Date);
    expect(await db.analyticsEvent.count({ where: { type: "WHATSAPP_CLICK" } })).toBe(1);
  });

  it("registra uma única vez mesmo com chamadas concorrentes", async () => {
    const { property, best } = await setup();
    const { leadId, token } = await startLead(contact(property.id));
    await submitAnswers(leadId, token, { answers: best }, { appUrl });
    await Promise.all([registerWhatsappClick(leadId, token), registerWhatsappClick(leadId, token)]);
    expect(await db.analyticsEvent.count({ where: { type: "WHATSAPP_CLICK" } })).toBe(1);
  });
});

describe("recordPublicEvent e getPublicQuestions", () => {
  it("registra visualização com canal e ignora imóvel não publicado", async () => {
    const { ctx, property } = await setup();
    await recordPublicEvent({ propertyId: property.id, type: "PAGE_VIEW", visitorId: "v1", attribution: { utmSource: "qrcode" } });
    const ev = await db.analyticsEvent.findFirstOrThrow();
    expect(ev).toMatchObject({ accountId: ctx.accountId, channel: "QR_CODE", type: "PAGE_VIEW" });
    const draft = await createProperty(ctx, propertyInput({ title: "Outro imóvel" }));
    await expect(recordPublicEvent({ propertyId: draft.id, type: "PAGE_VIEW" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("não expõe pesos ao visitante", async () => {
    const { property } = await setup();
    const qs = await getPublicQuestions(property.id);
    expect(qs).toHaveLength(5);
    expect(JSON.stringify(qs)).not.toContain("weight");
  });
});
