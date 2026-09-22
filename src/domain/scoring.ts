import { visibleQuestions } from "./questionnaire";
import type { AnswerMap, AnswerValue, Classification, QuestionDef } from "./types";

export const HIGH_THRESHOLD = 0.6;
export const MEDIUM_THRESHOLD = 0.3;

export interface ScoreResult {
  score: number;
  maxScore: number;
  classification: Classification;
  pointsByQuestion: Record<string, number>;
}

export function questionMaxPoints(q: QuestionDef): number {
  const weights = q.options.map((o) => o.weight);
  switch (q.type) {
    case "SINGLE_CHOICE":
    case "YES_NO":
      return Math.max(0, ...weights);
    case "MULTI_CHOICE":
      return weights.filter((w) => w > 0).reduce((sum, w) => sum + w, 0);
    default:
      return 0;
  }
}

export function answerPoints(q: QuestionDef, a: AnswerValue | undefined): number {
  if (q.type === "TEXT" || q.type === "NUMBER" || !a?.optionIds?.length) return 0;
  const weights = new Map(q.options.map((o) => [o.id, o.weight]));
  const ids = q.type === "MULTI_CHOICE" ? a.optionIds : a.optionIds.slice(0, 1);
  return Math.max(0, ids.reduce((sum, id) => sum + (weights.get(id) ?? 0), 0));
}

export function classify(score: number, maxScore: number): Classification {
  if (maxScore <= 0) return "UNRATED";
  const pct = score / maxScore;
  if (pct >= HIGH_THRESHOLD) return "HIGH";
  if (pct >= MEDIUM_THRESHOLD) return "MEDIUM";
  return "LOW";
}

export function scoreAnswers(questions: QuestionDef[], answers: AnswerMap): ScoreResult {
  const pointsByQuestion: Record<string, number> = {};
  let score = 0;
  let maxScore = 0;
  for (const q of visibleQuestions(questions, answers)) {
    const points = answerPoints(q, answers[q.id]);
    pointsByQuestion[q.id] = points;
    score += points;
    maxScore += questionMaxPoints(q);
  }
  return { score, maxScore, classification: classify(score, maxScore), pointsByQuestion };
}

/** Pontuação normalizada para 0–100 (ex.: 65/100); `null` quando não há perguntas pontuáveis. */
export function scoreOutOf100(score: number, maxScore: number): number | null {
  if (maxScore <= 0) return null;
  return Math.round((Math.min(score, maxScore) / maxScore) * 100);
}

/** Forma mínima de uma pergunta para calcular pontuação máxima (editor do questionário). */
export type WeightedQuestion = { type: QuestionDef["type"]; options: { weight: number }[] };

/** Pontuação máxima de uma pergunta a partir só do tipo e dos pesos. */
export function weightedMaxPoints(q: WeightedQuestion): number {
  return questionMaxPoints({
    id: "",
    label: "",
    type: q.type,
    required: false,
    isVisitIntent: false,
    showIf: null,
    options: q.options.map((o, i) => ({ id: String(i), label: "", weight: o.weight })),
  });
}

/**
 * Pontuação máxima do questionário. Com `draft`, a pergunta `replaceId` é trocada pelo rascunho
 * (ou o rascunho é somado, quando `replaceId` não está na lista — pergunta nova).
 */
export function questionnaireMaxPoints(
  questions: (WeightedQuestion & { id: string })[],
  draft?: { replaceId: string | null; question: WeightedQuestion } | null,
): number {
  const saved = questions.reduce(
    (sum, q) => (draft && q.id === draft.replaceId ? sum : sum + weightedMaxPoints(q)),
    0,
  );
  return saved + (draft ? weightedMaxPoints(draft.question) : 0);
}

/** Menor pontuação (em pontos inteiros) que atinge Alta e Média para um máximo dado. */
export function classificationThresholds(maxScore: number): { high: number; medium: number } | null {
  if (maxScore <= 0) return null;
  return { high: Math.ceil(maxScore * HIGH_THRESHOLD), medium: Math.ceil(maxScore * MEDIUM_THRESHOLD) };
}
