import { describe, expect, it } from "vitest";
import { classify, questionMaxPoints, scoreAnswers } from "@/domain/scoring";
import type { QuestionDef } from "@/domain/types";
import { pick, questions } from "./fixtures";

describe("classify", () => {
  it("aplica limites de 60% e 30%", () => {
    expect(classify(60, 100)).toBe("HIGH");
    expect(classify(59, 100)).toBe("MEDIUM");
    expect(classify(30, 100)).toBe("MEDIUM");
    expect(classify(29, 100)).toBe("LOW");
    expect(classify(0, 0)).toBe("UNRATED");
  });
});

describe("questionMaxPoints", () => {
  it("usa o maior peso em escolha única e a soma em múltipla", () => {
    expect(questionMaxPoints(questions[1])).toBe(30);
    const multi: QuestionDef = { ...questions[1], type: "MULTI_CHOICE" };
    expect(questionMaxPoints(multi)).toBe(75);
    expect(questionMaxPoints({ ...questions[0], type: "TEXT", options: [] })).toBe(0);
  });
});

describe("scoreAnswers", () => {
  it("lead ideal soma 100 de 100 → HIGH", () => {
    const r = scoreAnswers(questions, pick({ q1: "q1a", q2: "q2a", q3: "q3a", q4: "q4a", q5: "q5a" }));
    expect(r).toMatchObject({ score: 100, maxScore: 100, classification: "HIGH" });
    expect(r.pointsByQuestion).toEqual({ q1: 0, q2: 30, q3: 25, q4: 20, q5: 25 });
  });
  it("65 pontos → HIGH", () => {
    const r = scoreAnswers(questions, pick({ q1: "q1a", q2: "q2b", q3: "q3b", q4: "q4b", q5: "q5a" }));
    expect(r.score).toBe(65);
    expect(r.classification).toBe("HIGH");
  });
  it("exatamente 30 → MEDIUM", () => {
    const r = scoreAnswers(questions, pick({ q1: "q1a", q2: "q2c", q3: "q3b", q4: "q4b", q5: "q5b" }));
    expect(r.score).toBe(30);
    expect(r.classification).toBe("MEDIUM");
  });
  it("só pesquisando → LOW", () => {
    const r = scoreAnswers(questions, pick({ q1: "q1c", q2: "q2d", q3: "q3d", q4: "q4b", q5: "q5b" }));
    expect(r.classification).toBe("LOW");
  });
  it("sem perguntas pontuáveis → UNRATED", () => {
    expect(scoreAnswers([questions[0]], pick({ q1: "q1a" })).classification).toBe("UNRATED");
  });
  it("ignora opção de outra pergunta", () => {
    expect(scoreAnswers(questions, pick({ q2: "q3a" })).score).toBe(0);
  });
  it("pergunta oculta por condição não entra no máximo", () => {
    const conditional: QuestionDef = {
      id: "q6", label: "Já tem crédito aprovado?", type: "YES_NO", required: false, isVisitIntent: false,
      showIf: { questionId: "q3", optionIds: ["q3b"] }, options: [{ id: "q6a", label: "Sim", weight: 20 }, { id: "q6b", label: "Não", weight: 0 }],
    };
    const all = [...questions, conditional];
    const cash = scoreAnswers(all, pick({ q1: "q1a", q2: "q2a", q3: "q3a", q4: "q4a", q5: "q5a" }));
    expect(cash.maxScore).toBe(100);
    const financed = scoreAnswers(all, pick({ q1: "q1a", q2: "q2a", q3: "q3b", q4: "q4a", q5: "q5a", q6: "q6a" }));
    expect(financed.maxScore).toBe(120);
    expect(financed.score).toBe(110);
  });
});
