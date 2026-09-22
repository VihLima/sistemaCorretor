import type { AnswerMap, AnswerValue, QuestionDef, ShowIf } from "./types";

export function isAnswered(q: Pick<QuestionDef, "type">, a: AnswerValue | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case "TEXT":
      return !!a.text?.trim();
    case "NUMBER":
      return typeof a.number === "number" && Number.isFinite(a.number);
    default:
      return (a.optionIds?.length ?? 0) > 0;
  }
}

/** Perguntas visíveis dadas as respostas atuais. Supõe pais antes dos filhos (ordem por posição). */
export function visibleQuestions<Q extends Pick<QuestionDef, "id" | "showIf">>(
  questions: Q[],
  answers: AnswerMap,
): Q[] {
  const visible: Q[] = [];
  const visibleIds = new Set<string>();
  for (const q of questions) {
    if (q.showIf) {
      const { questionId, optionIds } = q.showIf;
      if (!visibleIds.has(questionId)) continue;
      const selected = answers[questionId]?.optionIds ?? [];
      if (!selected.some((id) => optionIds.includes(id))) continue;
    }
    visible.push(q);
    visibleIds.add(q.id);
  }
  return visible;
}

export function validateAnswers(questions: QuestionDef[], answers: AnswerMap): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of visibleQuestions(questions, answers)) {
    const a = answers[q.id];
    if (!isAnswered(q, a)) {
      if (q.required) errors[q.id] = "Responda esta pergunta";
      continue;
    }
    if (q.type === "TEXT" && a!.text!.length > 500) {
      errors[q.id] = "Resposta muito longa (máx. 500 caracteres)";
    } else if (q.type === "NUMBER" && (a!.number! < 0 || a!.number! > 1e12)) {
      errors[q.id] = "Número inválido";
    } else if (q.type !== "TEXT" && q.type !== "NUMBER") {
      const ids = a!.optionIds!;
      const valid = new Set(q.options.map((o) => o.id));
      if (ids.some((id) => !valid.has(id))) errors[q.id] = "Opção inválida";
      else if (q.type !== "MULTI_CHOICE" && ids.length > 1) errors[q.id] = "Escolha apenas uma opção";
    }
  }
  return errors;
}

const numberFmt = new Intl.NumberFormat("pt-BR");

export function formatAnswer(q: QuestionDef, a: AnswerValue): string {
  switch (q.type) {
    case "TEXT":
      return a.text?.trim() ?? "";
    case "NUMBER":
      return a.number === undefined ? "" : numberFmt.format(a.number);
    default: {
      const labels = new Map(q.options.map((o) => [o.id, o.label]));
      return (a.optionIds ?? []).map((id) => labels.get(id)).filter(Boolean).join(", ");
    }
  }
}

export function detectVisitIntent(questions: QuestionDef[], answers: AnswerMap): boolean {
  return visibleQuestions(questions, answers).some((q) => {
    if (!q.isVisitIntent) return false;
    const selected = new Set(answers[q.id]?.optionIds ?? []);
    return q.options.some(
      (o) => selected.has(o.id) && (o.weight > 0 || o.label.trim().toLowerCase() === "sim"),
    );
  });
}

export function parseShowIf(value: unknown): ShowIf | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.questionId !== "string" || !Array.isArray(v.optionIds)) return null;
  if (!v.optionIds.every((id) => typeof id === "string")) return null;
  return { questionId: v.questionId, optionIds: v.optionIds as string[] };
}
