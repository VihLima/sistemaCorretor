import { DEFAULT_QUESTIONNAIRE, YES_NO_LABELS } from "@/domain/default-questionnaire";
import { parseShowIf } from "@/domain/questionnaire";
import type { QuestionDef } from "@/domain/types";
import { parseOrThrow } from "@/lib/validation/parse";
import { type QuestionInput, questionSchema } from "@/lib/validation/question";
import type { Ctx } from "@/server/context";
import { db, type Tx } from "@/server/db";
import { NotFoundError, ValidationError } from "@/server/errors";

export async function createDefaultQuestionnaire(tx: Tx, accountId: string) {
  return tx.questionnaire.create({
    data: {
      accountId,
      name: "Questionário padrão",
      isDefault: true,
      questions: {
        create: DEFAULT_QUESTIONNAIRE.map((q, i) => ({
          label: q.label,
          type: q.type,
          required: q.required,
          isVisitIntent: q.isVisitIntent,
          position: i,
          options: { create: q.options.map((o, j) => ({ label: o.label, weight: o.weight, position: j })) },
        })),
      },
    },
  });
}

export const MAX_QUESTIONS = 10;

const questionsInclude = {
  questions: {
    orderBy: { position: "asc" as const },
    include: { options: { orderBy: { position: "asc" as const } } },
  },
};

function normalize(q: QuestionInput): QuestionInput {
  if (q.type === "TEXT" || q.type === "NUMBER") return { ...q, options: [] };
  if (q.type === "YES_NO") {
    return {
      ...q,
      options: YES_NO_LABELS.map((label, i) => ({ id: q.options[i]?.id, label, weight: q.options[i]?.weight ?? 0 })),
    };
  }
  return q;
}

export async function getDefaultQuestionnaire(ctx: Ctx) {
  const qn = await db.questionnaire.findFirst({
    where: { accountId: ctx.accountId, isDefault: true, propertyId: null },
    include: questionsInclude,
  });
  if (!qn) throw new NotFoundError("Questionário");
  return qn;
}

async function getOwnedQuestion(ctx: Ctx, id: string) {
  const q = await db.question.findFirst({
    where: { id, questionnaire: { accountId: ctx.accountId } },
    include: { options: { orderBy: { position: "asc" } } },
  });
  if (!q) throw new NotFoundError("Pergunta");
  return q;
}

export async function createQuestion(ctx: Ctx, input: unknown) {
  const data = normalize(parseOrThrow(questionSchema, input));
  const qn = await getDefaultQuestionnaire(ctx);
  if (qn.questions.length >= MAX_QUESTIONS) {
    const msg = `Máximo de ${MAX_QUESTIONS} perguntas — questionários curtos convertem mais.`;
    throw new ValidationError({ _form: msg }, msg);
  }
  return db.question.create({
    data: {
      questionnaireId: qn.id,
      label: data.label,
      type: data.type,
      required: data.required,
      isVisitIntent: data.isVisitIntent,
      position: qn.questions.length,
      options: { create: data.options.map((o, i) => ({ label: o.label, weight: o.weight, position: i })) },
    },
    include: { options: { orderBy: { position: "asc" } } },
  });
}

export async function updateQuestion(ctx: Ctx, id: string, input: unknown) {
  const existing = await getOwnedQuestion(ctx, id);
  const data = normalize(parseOrThrow(questionSchema, input));
  const existingIds = new Set(existing.options.map((o) => o.id));
  const keepIds = data.options.map((o) => o.id).filter((oid): oid is string => !!oid && existingIds.has(oid));
  return db.$transaction(async (tx) => {
    await tx.questionOption.deleteMany({ where: { questionId: id, id: { notIn: keepIds } } });
    for (const [i, o] of data.options.entries()) {
      if (o.id && existingIds.has(o.id)) {
        await tx.questionOption.update({ where: { id: o.id }, data: { label: o.label, weight: o.weight, position: i } });
      } else {
        await tx.questionOption.create({ data: { questionId: id, label: o.label, weight: o.weight, position: i } });
      }
    }
    return tx.question.update({
      where: { id },
      data: { label: data.label, type: data.type, required: data.required, isVisitIntent: data.isVisitIntent },
      include: { options: { orderBy: { position: "asc" } } },
    });
  });
}

export async function deleteQuestion(ctx: Ctx, id: string) {
  const q = await getOwnedQuestion(ctx, id);
  await db.question.delete({ where: { id } });
  const rest = await db.question.findMany({ where: { questionnaireId: q.questionnaireId }, orderBy: { position: "asc" } });
  await db.$transaction(rest.map((r, i) => db.question.update({ where: { id: r.id }, data: { position: i } })));
}

export async function moveQuestion(ctx: Ctx, id: string, direction: "up" | "down") {
  const q = await getOwnedQuestion(ctx, id);
  const siblings = await db.question.findMany({ where: { questionnaireId: q.questionnaireId }, orderBy: { position: "asc" } });
  const index = siblings.findIndex((s) => s.id === id);
  const target = siblings[direction === "up" ? index - 1 : index + 1];
  if (!target) return;
  await db.$transaction([
    db.question.update({ where: { id: q.id }, data: { position: target.position } }),
    db.question.update({ where: { id: target.id }, data: { position: q.position } }),
  ]);
}

export async function getQuestionDefsForProperty(propertyId: string, accountId: string): Promise<QuestionDef[]> {
  const qn =
    (await db.questionnaire.findFirst({ where: { accountId, propertyId }, include: questionsInclude })) ??
    (await db.questionnaire.findFirst({ where: { accountId, isDefault: true, propertyId: null }, include: questionsInclude }));
  if (!qn) return [];
  return qn.questions.map((q) => ({
    id: q.id,
    label: q.label,
    type: q.type,
    required: q.required,
    isVisitIntent: q.isVisitIntent,
    showIf: parseShowIf(q.showIf),
    options: q.options.map((o) => ({ id: o.id, label: o.label, weight: o.weight })),
  }));
}
