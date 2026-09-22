import { describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/server/errors";
import {
  createQuestion, deleteQuestion, getDefaultQuestionnaire, getQuestionDefsForProperty, moveQuestion, updateQuestion,
} from "@/server/services/questionnaires";
import { makeAgent, makePublishedProperty } from "./helpers";

const choice = {
  label: "Quantos quartos procura?",
  type: "SINGLE_CHOICE",
  required: false,
  options: [{ label: "1 ou 2", weight: 5 }, { label: "3 ou mais", weight: 10 }],
};

describe("questionário padrão", () => {
  it("vem com 5 perguntas ordenadas", async () => {
    const ctx = await makeAgent();
    const qn = await getDefaultQuestionnaire(ctx);
    expect(qn.questions.map((q) => q.position)).toEqual([0, 1, 2, 3, 4]);
    expect(qn.questions[1].options[0]).toMatchObject({ label: "Imediatamente", weight: 30 });
  });

  it("imóvel usa o questionário padrão da conta", async () => {
    const ctx = await makeAgent();
    const p = await makePublishedProperty(ctx);
    const defs = await getQuestionDefsForProperty(p.id, ctx.accountId);
    expect(defs).toHaveLength(5);
    expect(defs[0]).toMatchObject({ type: "SINGLE_CHOICE", showIf: null });
  });
});

describe("edição de perguntas", () => {
  it("cria pergunta no final", async () => {
    const ctx = await makeAgent();
    const q = await createQuestion(ctx, choice);
    expect(q.position).toBe(5);
    expect(q.options.map((o) => o.label)).toEqual(["1 ou 2", "3 ou mais"]);
  });

  it("exige 2 opções em escolha e normaliza sim/não", async () => {
    const ctx = await makeAgent();
    await expect(createQuestion(ctx, { ...choice, options: [{ label: "só uma", weight: 0 }] })).rejects.toBeInstanceOf(ValidationError);
    const yn = await createQuestion(ctx, { label: "Tem pets?", type: "YES_NO", required: true, options: [{ label: "x", weight: 7 }] });
    expect(yn.options.map((o) => [o.label, o.weight])).toEqual([["Sim", 7], ["Não", 0]]);
  });

  it("atualiza opções mantendo, criando e removendo", async () => {
    const ctx = await makeAgent();
    const q = await createQuestion(ctx, choice);
    const updated = await updateQuestion(ctx, q.id, {
      ...choice,
      label: "Quartos?",
      options: [{ id: q.options[1].id, label: "3+", weight: 12 }, { label: "Studio", weight: 0 }],
    });
    expect(updated.label).toBe("Quartos?");
    expect(updated.options.map((o) => [o.label, o.weight])).toEqual([["3+", 12], ["Studio", 0]]);
    expect(updated.options[0].id).toBe(q.options[1].id);
  });

  it("mudar para texto remove as opções", async () => {
    const ctx = await makeAgent();
    const q = await createQuestion(ctx, choice);
    const updated = await updateQuestion(ctx, q.id, { ...choice, type: "TEXT", options: [] });
    expect(updated.options).toHaveLength(0);
  });

  it("move e exclui renumerando", async () => {
    const ctx = await makeAgent();
    const before = (await getDefaultQuestionnaire(ctx)).questions;
    await moveQuestion(ctx, before[1].id, "up");
    let after = (await getDefaultQuestionnaire(ctx)).questions;
    expect(after.slice(0, 2).map((q) => q.id)).toEqual([before[1].id, before[0].id]);
    await moveQuestion(ctx, after[0].id, "up"); // já é a primeira: sem efeito
    await deleteQuestion(ctx, after[0].id);
    after = (await getDefaultQuestionnaire(ctx)).questions;
    expect(after.map((q) => q.position)).toEqual([0, 1, 2, 3]);
  });

  it("limita a 10 perguntas", async () => {
    const ctx = await makeAgent();
    for (let i = 0; i < 5; i++) await createQuestion(ctx, choice);
    await expect(createQuestion(ctx, choice)).rejects.toThrow(/10 perguntas/);
  });

  it("corretor B não altera perguntas de A", async () => {
    const a = await makeAgent();
    const b = await makeAgent();
    const q = (await getDefaultQuestionnaire(a)).questions[0];
    await expect(updateQuestion(b, q.id, choice)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteQuestion(b, q.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(moveQuestion(b, q.id, "down")).rejects.toBeInstanceOf(NotFoundError);
    expect((await getDefaultQuestionnaire(b)).questions.map((x) => x.id)).not.toContain(q.id);
  });
});
