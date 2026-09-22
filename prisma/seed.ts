import "dotenv/config";
import { randomUUID } from "node:crypto";
import { CONSENT_TEXT } from "@/domain/consent";
import { detectVisitIntent, formatAnswer, isAnswered, visibleQuestions } from "@/domain/questionnaire";
import { scoreAnswers } from "@/domain/scoring";
import type { AnswerMap, Channel, LeadStatus, QuestionDef } from "@/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { Ctx } from "@/server/context";
import { signup } from "@/server/services/accounts";
import { createProperty, setPropertyStatus } from "@/server/services/properties";
import { updateProfile } from "@/server/services/profile";
import { getQuestionDefsForProperty } from "@/server/services/questionnaires";

const EMAIL = "ana@exemplo.com";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// ---------- helpers ----------

function daysAgo(days: number, extraHours = 0): Date {
  return new Date(Date.now() - days * 86_400_000 - extraHours * 3_600_000);
}

function randomDayInLast30(): number {
  return Math.random() * 30;
}

function leadPhone(n: number): string {
  const suffix = String(20_000_000 + n * 137_651).slice(-8);
  return `5567 9${suffix}`.replace(/\s/g, "");
}

const CHANNEL_WEIGHTS: [Channel, number][] = [
  ["INSTAGRAM", 0.4],
  ["FACEBOOK", 0.2],
  ["GOOGLE", 0.15],
  ["QR_CODE", 0.15],
  ["DIRECT", 0.1],
];

function pickChannel(): Channel {
  const r = Math.random();
  let acc = 0;
  for (const [channel, weight] of CHANNEL_WEIGHTS) {
    acc += weight;
    if (r <= acc) return channel;
  }
  return "DIRECT";
}

// Índices de opção (por posição) para as 5 perguntas padrão:
// [comprar/alugar (não pontua), quando fecha (30/25/15/5), como paga (25/15/10/0),
//  tem entrada (20/0), quer visita (25/0)]. maxScore total = 100.
type Combo = [number, number, number, number];
const HIGH_COMBOS: Combo[] = [
  [0, 0, 0, 0], // 100
  [1, 0, 0, 0], // 95
  [0, 1, 0, 0], // 90
];
const MEDIUM_COMBOS: Combo[] = [
  [1, 3, 0, 1], // 45
  [2, 1, 1, 0], // 55
  [3, 0, 0, 1], // 50
];
const LOW_COMBOS: Combo[] = [
  [3, 3, 1, 1], // 5
  [2, 3, 1, 1], // 15
  [3, 2, 1, 1], // 15
];

type Profile = "high" | "medium" | "low";

function buildAnswers(questions: QuestionDef[], profile: Profile, variant: number): AnswerMap {
  const [purpose, timing, payment, entrada, visita] = questions;
  const combos = profile === "high" ? HIGH_COMBOS : profile === "medium" ? MEDIUM_COMBOS : LOW_COMBOS;
  const [timingIdx, paymentIdx, entradaIdx, visitaIdx] = combos[variant % combos.length];
  const purposeIdx = variant % purpose.options.length;
  return {
    [purpose.id]: { optionIds: [purpose.options[purposeIdx].id] },
    [timing.id]: { optionIds: [timing.options[timingIdx].id] },
    [payment.id]: { optionIds: [payment.options[paymentIdx].id] },
    [entrada.id]: { optionIds: [entrada.options[entradaIdx].id] },
    [visita.id]: { optionIds: [visita.options[visitaIdx].id] },
  };
}

// ---------- fotos (Unsplash; checadas com curl -sI antes do commit) ----------

const PHOTO_IDS = {
  casa: ["1568605114967-8130f3a36994", "1570129477492-45c003edd2be", "1600585154340-be6161a56a0c", "1512917774080-9991f1c4c750"],
  apartamento: ["1523217582562-09d0def993a6", "1502672260266-1c1ef2d93688", "1493809842364-78817add7ffb", "1560185127-6ed189bf02f4"],
  sobrado: ["1600607687939-ce8a6c25118c", "1600566753086-00f18fb6b3ea", "1512918728675-ed5a9ecdebfd", "1580587771525-78b9dba3b914"],
} as const;

function photoUrl(id: string): string {
  return `https://images.unsplash.com/photo-${id}?w=1600&q=80`;
}

// ---------- main ----------

/**
 * O seed apaga e recria a conta de exemplo: só roda contra um banco local (localhost/127.0.0.1)
 * fora de produção, a menos que ALLOW_SEED=1 seja definido de propósito.
 */
function assertSafeToSeed() {
  if (process.env.ALLOW_SEED === "1") return;
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    /* URL inválida: tratada como não local */
  }
  const local = host === "localhost" || host === "127.0.0.1";
  if (process.env.NODE_ENV === "production" || !local) {
    throw new Error(
      `Seed recusado: NODE_ENV=${process.env.NODE_ENV ?? "(vazio)"}, host do banco "${host || "?"}". ` +
        "O seed só roda em banco local fora de produção. Para forçar, defina ALLOW_SEED=1.",
    );
  }
}

async function main() {
  assertSafeToSeed();
  // idempotência: remove conta de exemplo anterior (leads/imóveis primeiro por causa do Restrict)
  const existing = await db.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await db.lead.deleteMany({ where: { accountId: existing.accountId } });
    await db.property.deleteMany({ where: { accountId: existing.accountId } });
    await db.account.delete({ where: { id: existing.accountId } });
  }

  const ctx: Ctx = await signup({ name: "Ana Martins", email: EMAIL, password: "demo12345" });

  await updateProfile(ctx, {
    name: "Ana Martins",
    whatsapp: "5567999990000",
    creci: "12345-F/MS",
    agencyName: "Martins Imóveis",
    bio: "Corretora em Campo Grande há 12 anos, especialista em imóveis residenciais nos bairros Jardim dos Estados, Centro e Carandá Bosque.",
    instagramUrl: "https://instagram.com/anamartins.imoveis",
  });

  const casa = await createProperty(ctx, {
    title: "Casa no Jardim dos Estados",
    type: "HOUSE",
    purpose: "SALE",
    price: 850_000,
    city: "Campo Grande",
    neighborhood: "Jardim dos Estados",
    showAddress: false,
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parkingSpots: 2,
    builtArea: 180,
    description:
      "Casa térrea reformada em rua arborizada e tranquila, a poucos minutos do Parque das Nações Indígenas. Sala ampla com pé-direito alto, cozinha planejada integrada à área gourmet e quintal com espaço para piscina. Ótima para quem busca conforto e privacidade sem abrir mão da localização central.",
    highlights: ["Área gourmet com churrasqueira", "Quintal amplo", "Reformada recentemente", "Rua tranquila e arborizada", "Perto do Parque das Nações Indígenas"],
  });

  const apartamento = await createProperty(ctx, {
    title: "Apartamento no Centro",
    type: "APARTMENT",
    purpose: "RENT",
    price: 2_300,
    condoFee: 450,
    city: "Campo Grande",
    neighborhood: "Centro",
    showAddress: false,
    bedrooms: 2,
    bathrooms: 1,
    parkingSpots: 1,
    builtArea: 65,
    description:
      "Apartamento de 2 quartos no coração do Centro, a poucos passos do calçadão e do comércio da região. Prédio com portaria 24h, elevador e sacada com vista para a cidade. Ideal para quem trabalha na região central e valoriza praticidade no dia a dia.",
    highlights: ["Portaria 24h", "Sacada com vista", "A pé do calçadão", "Próximo a comércio e transporte"],
  });

  const sobrado = await createProperty(ctx, {
    title: "Sobrado no Carandá Bosque",
    type: "TOWNHOUSE",
    purpose: "SALE",
    price: 1_290_000,
    city: "Campo Grande",
    neighborhood: "Carandá Bosque",
    showAddress: false,
    bedrooms: 4,
    suites: 3,
    bathrooms: 4,
    parkingSpots: 4,
    builtArea: 320,
    description:
      "Sobrado de alto padrão em um dos bairros mais nobres de Campo Grande. Quatro suítes amplas, escritório, living em dois ambientes e área externa com piscina e espaço gourmet completo. Acabamento de primeira linha em toda a construção, pronto para morar.",
    highlights: ["4 suítes", "Piscina e área gourmet", "Escritório", "Acabamento de alto padrão", "Bairro nobre"],
  });

  const properties = [
    { property: casa, photos: PHOTO_IDS.casa },
    { property: apartamento, photos: PHOTO_IDS.apartamento },
    { property: sobrado, photos: PHOTO_IDS.sobrado },
  ];

  for (const { property, photos } of properties) {
    await db.propertyImage.createMany({
      data: photos.map((id, i) => ({
        propertyId: property.id,
        url: photoUrl(id),
        storageKey: `seed/${property.slug}-${i}`,
        position: i,
      })),
    });
    await setPropertyStatus(ctx, property.id, "PUBLISHED");
  }

  // ---------- analytics: ~40 PAGE_VIEW por imóvel, últimos 30 dias ----------
  for (const { property } of properties) {
    await db.analyticsEvent.createMany({
      data: Array.from({ length: 40 }, () => ({
        accountId: ctx.accountId,
        propertyId: property.id,
        type: "PAGE_VIEW" as const,
        visitorId: randomUUID(),
        channel: pickChannel(),
        createdAt: daysAgo(randomDayInLast30()),
      })),
    });
  }

  // ---------- leads ----------
  type LeadSpec = {
    name: string;
    property: typeof casa;
    profile: Profile | null; // null = incompleto
    variant: number;
    status: LeadStatus;
    whatsappClicked: boolean;
    note?: string;
  };

  const specs: LeadSpec[] = [
    { name: "João Pereira", property: casa, profile: "high", variant: 0, status: "NEGOTIATING", whatsappClicked: true, note: "Quer visitar no fim de semana, já tem financiamento pré-aprovado no banco." },
    { name: "Mariana Costa", property: casa, profile: "medium", variant: 0, status: "CONTACTED", whatsappClicked: true },
    { name: "Rafael Oliveira", property: casa, profile: "low", variant: 0, status: "NEW", whatsappClicked: false },
    { name: "Beatriz Santos", property: casa, profile: "high", variant: 1, status: "VISIT_SCHEDULED", whatsappClicked: true, note: "Confirmou visita para sábado às 10h." },
    { name: "Lucas Almeida", property: casa, profile: null, variant: 0, status: "NEW", whatsappClicked: false },
    { name: "Camila Rodrigues", property: apartamento, profile: "medium", variant: 1, status: "CONTACTED", whatsappClicked: true },
    { name: "Gabriel Souza", property: apartamento, profile: "high", variant: 2, status: "NEGOTIATING", whatsappClicked: true },
    { name: "Larissa Lima", property: apartamento, profile: "low", variant: 1, status: "LOST", whatsappClicked: false },
    { name: "Pedro Henrique", property: apartamento, profile: "medium", variant: 2, status: "NEW", whatsappClicked: false },
    { name: "Fernanda Alves", property: apartamento, profile: null, variant: 0, status: "NEW", whatsappClicked: false },
    { name: "Thiago Martins", property: sobrado, profile: "high", variant: 0, status: "VISIT_SCHEDULED", whatsappClicked: true },
    { name: "Juliana Ferreira", property: sobrado, profile: "medium", variant: 0, status: "CONTACTED", whatsappClicked: true },
    { name: "Bruno Carvalho", property: sobrado, profile: "low", variant: 2, status: "LOST", whatsappClicked: false },
    { name: "Amanda Ribeiro", property: sobrado, profile: "high", variant: 1, status: "NEW", whatsappClicked: true },
  ];

  let i = 0;
  for (const spec of specs) {
    i += 1;
    const day = randomDayInLast30();
    const createdAt = daysAgo(day);
    const channel = pickChannel();
    const phone = leadPhone(i);
    const email = i % 3 === 0 ? null : `${spec.name.toLowerCase().replace(/\s+/g, ".")}@exemplo.com`;

    const propQuestions = await getQuestionDefsForProperty(spec.property.id, ctx.accountId);

    const isComplete = spec.profile !== null;
    const answers = isComplete ? buildAnswers(propQuestions, spec.profile as Profile, spec.variant) : {};
    const result = isComplete ? scoreAnswers(propQuestions, answers) : { score: 0, maxScore: 0, classification: "UNRATED" as const, pointsByQuestion: {} };
    const answered = isComplete ? visibleQuestions(propQuestions, answers).filter((q) => isAnswered(q, answers[q.id])) : [];
    const wantsVisit = isComplete && detectVisitIntent(propQuestions, answers);

    const completedAt = isComplete ? new Date(createdAt.getTime() + 3 * 60_000) : null;
    const historyAt = daysAgo(Math.max(day - 0.25, 0));
    const whatsappClickedAt = spec.whatsappClicked ? daysAgo(Math.max(day - 0.3, 0)) : null;

    type HistoryEntry = { fromStatus: LeadStatus | null; toStatus: LeadStatus; changedById: string | null; createdAt: Date };
    const historyEntries: HistoryEntry[] =
      spec.status === "NEW"
        ? [{ fromStatus: null, toStatus: "NEW", changedById: null, createdAt }]
        : [
            { fromStatus: null, toStatus: "NEW", changedById: null, createdAt },
            { fromStatus: "NEW", toStatus: spec.status, changedById: ctx.userId, createdAt: historyAt },
          ];

    const lead = await db.lead.create({
      data: {
        accountId: ctx.accountId,
        propertyId: spec.property.id,
        publicToken: randomUUID(),
        name: spec.name,
        phone,
        email,
        consentAt: createdAt,
        consentText: CONSENT_TEXT,
        score: result.score,
        maxScore: result.maxScore,
        classification: result.classification,
        status: spec.status,
        isComplete,
        completedAt,
        wantsVisit,
        channel,
        visitorId: randomUUID(),
        landingUrl: `${APP_URL}/imovel/${spec.property.slug}`,
        whatsappClickedAt,
        createdAt,
        updatedAt: completedAt ?? createdAt,
        answers: {
          create: answered.map((q, pos) => ({
            questionId: q.id,
            questionLabel: q.label,
            position: pos,
            value: answers[q.id] as Prisma.InputJsonValue,
            displayValue: formatAnswer(q, answers[q.id]),
            points: result.pointsByQuestion[q.id] ?? 0,
          })),
        },
        history: {
          create: historyEntries.map((h) => ({
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            changedById: h.changedById,
            createdAt: h.createdAt,
          })),
        },
      },
    });

    if (spec.note) {
      await db.leadNote.create({ data: { leadId: lead.id, authorId: ctx.userId, body: spec.note } });
    }
  }

  const urls = properties.map(({ property }) => `${APP_URL}/imovel/${property.slug}`);
  console.log("\nSeed concluído.");
  console.log(`Login: ${EMAIL} / demo12345`);
  console.log("Imóveis publicados:");
  for (const url of urls) console.log(`  - ${url}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
