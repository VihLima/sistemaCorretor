import { randomBytes, timingSafeEqual } from "node:crypto";
import { type Attribution, resolveAttribution } from "@/domain/attribution";
import { CONSENT_TEXT } from "@/domain/consent";
import { detectVisitIntent, formatAnswer, isAnswered, validateAnswers, visibleQuestions } from "@/domain/questionnaire";
import { scoreAnswers } from "@/domain/scoring";
import { buildLeadMessage, waMeChannel } from "@/domain/whatsapp";
import { answersSchema, publicEventSchema, startLeadSchema } from "@/lib/validation/lead";
import { parseOrThrow } from "@/lib/validation/parse";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { getQuestionDefsForProperty } from "./questionnaires";

const REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type Handoff = { whatsappUrl: string; message: string; lines: { label: string; value: string }[] };

async function getPublishedProperty(propertyId: string) {
  const property = await db.property.findFirst({ where: { id: propertyId, status: "PUBLISHED" } });
  if (!property) throw new NotFoundError("Imóvel");
  return property;
}

const attributionFields = (a: Attribution) => ({
  channel: a.channel, utmSource: a.utmSource, utmMedium: a.utmMedium, utmCampaign: a.utmCampaign,
  utmContent: a.utmContent, utmTerm: a.utmTerm, referrer: a.referrer,
});

function tokensMatch(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function loadLead(leadId: string, token: string) {
  if (typeof leadId !== "string" || leadId.length > 100 || typeof token !== "string" || token.length > 100) {
    throw new NotFoundError("Contato");
  }
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { property: { include: { agent: true } }, answers: { orderBy: { position: "asc" } } },
  });
  if (!lead || typeof token !== "string" || !tokensMatch(lead.publicToken, token)) throw new NotFoundError("Contato");
  return lead;
}

export async function startLead(input: unknown, opts: { ownHost?: string } = {}) {
  const data = parseOrThrow(startLeadSchema, input);
  const property = await getPublishedProperty(data.propertyId);
  const attribution = resolveAttribution({ ...data.attribution, ownHost: opts.ownHost });

  const existing = await db.lead.findFirst({
    where: {
      propertyId: property.id, phone: data.phone, isComplete: false,
      createdAt: { gte: new Date(Date.now() - REUSE_WINDOW_MS) },
    },
  });
  if (existing) {
    await db.lead.update({ where: { id: existing.id }, data: { name: data.name, email: data.email } });
    return { leadId: existing.id, token: existing.publicToken };
  }

  const lead = await db.lead.create({
    data: {
      accountId: property.accountId,
      propertyId: property.id,
      publicToken: randomBytes(24).toString("base64url"),
      name: data.name,
      phone: data.phone,
      email: data.email,
      consentAt: new Date(),
      consentText: CONSENT_TEXT,
      visitorId: data.visitorId,
      landingUrl: data.landingUrl,
      ...attributionFields(attribution),
      history: { create: { toStatus: "NEW" } },
    },
  });
  return { leadId: lead.id, token: lead.publicToken };
}

export async function submitAnswers(leadId: string, token: string, input: unknown, opts: { appUrl: string }) {
  const lead = await loadLead(leadId, token);
  if (lead.isComplete) return getHandoff(leadId, token, opts);
  if (lead.property.status !== "PUBLISHED") throw new NotFoundError("Imóvel");

  const { answers } = parseOrThrow(answersSchema, input);
  const questions = await getQuestionDefsForProperty(lead.propertyId, lead.accountId);
  const errors = validateAnswers(questions, answers);
  if (Object.keys(errors).length > 0) throw new ValidationError(errors, "Responda as perguntas obrigatórias");

  const answered = visibleQuestions(questions, answers).filter((q) => isAnswered(q, answers[q.id]));
  const result = scoreAnswers(questions, answers);

  await db.$transaction([
    db.leadAnswer.createMany({
      data: answered.map((q, i) => ({
        leadId,
        questionId: q.id,
        questionLabel: q.label,
        position: i,
        value: answers[q.id],
        displayValue: formatAnswer(q, answers[q.id]),
        points: result.pointsByQuestion[q.id] ?? 0,
      })),
    }),
    db.lead.update({
      where: { id: leadId },
      data: {
        isComplete: true,
        completedAt: new Date(),
        score: result.score,
        maxScore: result.maxScore,
        classification: result.classification,
        wantsVisit: detectVisitIntent(questions, answers),
      },
    }),
    db.analyticsEvent.create({
      data: {
        accountId: lead.accountId, propertyId: lead.propertyId, type: "QUESTIONNAIRE_COMPLETE",
        visitorId: lead.visitorId, channel: lead.channel, utmSource: lead.utmSource, utmCampaign: lead.utmCampaign,
      },
    }),
  ]);
  return getHandoff(leadId, token, opts);
}

export async function getHandoff(leadId: string, token: string, opts: { appUrl: string }): Promise<Handoff> {
  const lead = await loadLead(leadId, token);
  const phone = lead.property.agent.whatsapp;
  if (!phone) throw new NotFoundError("WhatsApp do corretor");
  const lines = lead.answers.map((a) => ({ label: a.questionLabel, value: a.displayValue }));
  const message = buildLeadMessage({
    leadName: lead.name,
    propertyTitle: lead.property.title,
    propertyUrl: `${opts.appUrl}/imovel/${lead.property.slug}`,
    lines,
  });
  return { whatsappUrl: waMeChannel.buildHandoffUrl({ phone, message }), message, lines };
}

export async function registerWhatsappClick(leadId: string, token: string) {
  const lead = await loadLead(leadId, token);
  if (lead.whatsappClickedAt) return;
  await db.$transaction(async (tx) => {
    const { count } = await tx.lead.updateMany({
      where: { id: leadId, whatsappClickedAt: null },
      data: { whatsappClickedAt: new Date() },
    });
    if (count === 1) {
      await tx.analyticsEvent.create({
        data: {
          accountId: lead.accountId, propertyId: lead.propertyId, type: "WHATSAPP_CLICK",
          visitorId: lead.visitorId, channel: lead.channel, utmSource: lead.utmSource, utmCampaign: lead.utmCampaign,
        },
      });
    }
  });
}

export async function recordPublicEvent(input: unknown, opts: { ownHost?: string } = {}) {
  const data = parseOrThrow(publicEventSchema, input);
  const property = await getPublishedProperty(data.propertyId);
  const a = resolveAttribution({ ...data.attribution, ownHost: opts.ownHost });
  await db.analyticsEvent.create({
    data: {
      accountId: property.accountId, propertyId: property.id, type: data.type, visitorId: data.visitorId,
      channel: a.channel, utmSource: a.utmSource, utmCampaign: a.utmCampaign,
    },
  });
}

export async function getPublicQuestions(propertyId: string) {
  const property = await getPublishedProperty(propertyId);
  const defs = await getQuestionDefsForProperty(property.id, property.accountId);
  return defs.map((q) => ({
    id: q.id,
    label: q.label,
    type: q.type,
    required: q.required,
    showIf: q.showIf,
    options: q.options.map(({ id, label }) => ({ id, label })),
  }));
}

export type PublicQuestion = Awaited<ReturnType<typeof getPublicQuestions>>[number];
