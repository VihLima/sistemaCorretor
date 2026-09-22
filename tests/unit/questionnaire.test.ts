import { describe, expect, it } from "vitest";
import { detectVisitIntent, formatAnswer, parseShowIf, validateAnswers, visibleQuestions } from "@/domain/questionnaire";
import type { QuestionDef } from "@/domain/types";
import { pick, questions } from "./fixtures";

const text: QuestionDef = { id: "t", label: "Observações", type: "TEXT", required: false, isVisitIntent: false, showIf: null, options: [] };
const num: QuestionDef = { id: "n", label: "Quantos quartos?", type: "NUMBER", required: true, isVisitIntent: false, showIf: null, options: [] };
const multi: QuestionDef = { id: "m", label: "O que é essencial?", type: "MULTI_CHOICE", required: false, isVisitIntent: false, showIf: null,
  options: [{ id: "m1", label: "Piscina", weight: 0 }, { id: "m2", label: "Quintal", weight: 0 }] };

describe("validateAnswers", () => {
  it("exige obrigatórias", () => {
    const errors = validateAnswers(questions, pick({ q1: "q1a" }));
    expect(Object.keys(errors).sort()).toEqual(["q2", "q3", "q4", "q5"]);
  });
  it("rejeita opção inexistente e múltiplas em escolha única", () => {
    expect(validateAnswers([questions[0]], pick({ q1: "zzz" }))).toEqual({ q1: "Opção inválida" });
    expect(validateAnswers([questions[0]], { q1: { optionIds: ["q1a", "q1b"] } })).toEqual({ q1: "Escolha apenas uma opção" });
  });
  it("aceita múltipla escolha, texto opcional vazio e número", () => {
    expect(validateAnswers([multi, text, num], { m: { optionIds: ["m1", "m2"] }, n: { number: 3 } })).toEqual({});
  });
  it("valida número e tamanho do texto", () => {
    expect(validateAnswers([num], { n: { number: -1 } })).toEqual({ n: "Número inválido" });
    expect(validateAnswers([text], { t: { text: "x".repeat(501) } })).toEqual({ t: "Resposta muito longa (máx. 500 caracteres)" });
  });
  it("não exige pergunta oculta", () => {
    const cond: QuestionDef = { ...questions[3], id: "c", required: true, showIf: { questionId: "q3", optionIds: ["q3b"] } };
    expect(validateAnswers([questions[2], cond], pick({ q3: "q3a" }))).toEqual({});
    expect(validateAnswers([questions[2], cond], pick({ q3: "q3b" }))).toEqual({ c: "Responda esta pergunta" });
  });
});

describe("visibleQuestions", () => {
  it("esconde filhos quando o pai está oculto", () => {
    const a: QuestionDef = { ...questions[3], id: "a", showIf: { questionId: "q3", optionIds: ["q3b"] } };
    const b: QuestionDef = { ...questions[3], id: "b", showIf: { questionId: "a", optionIds: ["q4a"] } };
    const ids = visibleQuestions([questions[2], a, b], { ...pick({ q3: "q3a" }), a: { optionIds: ["q4a"] } }).map((q) => q.id);
    expect(ids).toEqual(["q3"]);
  });
});

describe("formatAnswer", () => {
  it("formata cada tipo", () => {
    expect(formatAnswer(questions[1], { optionIds: ["q2b"] })).toBe("Em até 3 meses");
    expect(formatAnswer(multi, { optionIds: ["m1", "m2"] })).toBe("Piscina, Quintal");
    expect(formatAnswer(num, { number: 1500 })).toBe("1.500");
    expect(formatAnswer(text, { text: "  oi  " })).toBe("oi");
  });
});

describe("detectVisitIntent", () => {
  it("verdadeiro quando responde Sim na pergunta de visita", () => {
    expect(detectVisitIntent(questions, pick({ q5: "q5a" }))).toBe(true);
    expect(detectVisitIntent(questions, pick({ q5: "q5b" }))).toBe(false);
  });
});

describe("parseShowIf", () => {
  it("aceita formato válido e rejeita o resto", () => {
    expect(parseShowIf({ questionId: "q", optionIds: ["o"] })).toEqual({ questionId: "q", optionIds: ["o"] });
    expect(parseShowIf(null)).toBeNull();
    expect(parseShowIf({ questionId: 1 })).toBeNull();
  });
});
