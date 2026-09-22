import { describe, expect, it } from "vitest";
import { classificationThresholds, questionnaireMaxPoints, scoreOutOf100, weightedMaxPoints } from "@/domain/scoring";

const w = (...weights: number[]) => weights.map((weight) => ({ weight }));

describe("scoreOutOf100", () => {
  it("normaliza e arredonda para 0–100", () => {
    expect(scoreOutOf100(65, 100)).toBe(65);
    expect(scoreOutOf100(115, 115)).toBe(100);
    expect(scoreOutOf100(1, 3)).toBe(33);
    expect(scoreOutOf100(2, 3)).toBe(67);
    expect(scoreOutOf100(1, 200)).toBe(1); // 0,5 arredonda para cima
  });

  it("zero pontos com máximo positivo é 0", () => {
    expect(scoreOutOf100(0, 80)).toBe(0);
  });

  it("sem perguntas pontuáveis (máximo 0) é null", () => {
    expect(scoreOutOf100(0, 0)).toBeNull();
    expect(scoreOutOf100(10, 0)).toBeNull();
  });

  it("nunca passa de 100", () => {
    expect(scoreOutOf100(150, 100)).toBe(100);
  });
});

describe("weightedMaxPoints", () => {
  it("SIM/NÃO e escolha única usam o maior peso", () => {
    expect(weightedMaxPoints({ type: "YES_NO", options: w(25, 0) })).toBe(25);
    expect(weightedMaxPoints({ type: "SINGLE_CHOICE", options: w(30, 25, 15, 5) })).toBe(30);
  });

  it("múltipla escolha soma os pesos positivos", () => {
    expect(weightedMaxPoints({ type: "MULTI_CHOICE", options: w(10, 0, 5) })).toBe(15);
  });

  it("pesos 0, texto e número valem 0", () => {
    expect(weightedMaxPoints({ type: "SINGLE_CHOICE", options: w(0, 0, 0) })).toBe(0);
    expect(weightedMaxPoints({ type: "YES_NO", options: w(0, 0) })).toBe(0);
    expect(weightedMaxPoints({ type: "TEXT", options: [] })).toBe(0);
    expect(weightedMaxPoints({ type: "NUMBER", options: [] })).toBe(0);
  });
});

describe("questionnaireMaxPoints", () => {
  const questions = [
    { id: "a", type: "SINGLE_CHOICE" as const, options: w(0, 0, 0) },
    { id: "b", type: "SINGLE_CHOICE" as const, options: w(30, 25) },
    { id: "c", type: "YES_NO" as const, options: w(20, 0) },
    { id: "d", type: "TEXT" as const, options: [] },
  ];

  it("questionário vazio vale 0", () => {
    expect(questionnaireMaxPoints([])).toBe(0);
    expect(questionnaireMaxPoints([], null)).toBe(0);
  });

  it("soma o máximo de cada pergunta", () => {
    expect(questionnaireMaxPoints(questions)).toBe(50);
  });

  it("rascunho substitui a pergunta em edição", () => {
    expect(questionnaireMaxPoints(questions, { replaceId: "b", question: { type: "SINGLE_CHOICE", options: w(10, 40) } })).toBe(60);
    expect(questionnaireMaxPoints(questions, { replaceId: "c", question: { type: "TEXT", options: [] } })).toBe(30);
  });

  it("rascunho de pergunta nova é somado", () => {
    expect(questionnaireMaxPoints(questions, { replaceId: null, question: { type: "YES_NO", options: w(0, 15) } })).toBe(65);
  });
});

describe("classificationThresholds", () => {
  it("menor pontuação inteira que atinge 60% e 30%", () => {
    expect(classificationThresholds(100)).toEqual({ high: 60, medium: 30 });
    expect(classificationThresholds(115)).toEqual({ high: 69, medium: 35 });
    expect(classificationThresholds(1)).toEqual({ high: 1, medium: 1 });
  });

  it("sem pontuação possível não há limites", () => {
    expect(classificationThresholds(0)).toBeNull();
  });
});
