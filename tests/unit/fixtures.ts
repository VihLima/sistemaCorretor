import type { QuestionDef } from "@/domain/types";

const opt = (id: string, label: string, weight: number) => ({ id, label, weight });

export const questions: QuestionDef[] = [
  { id: "q1", label: "Pretende comprar ou alugar?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false, showIf: null,
    options: [opt("q1a", "Comprar", 0), opt("q1b", "Alugar", 0), opt("q1c", "Ainda não sei", 0)] },
  { id: "q2", label: "Quando pretende fechar negócio?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false, showIf: null,
    options: [opt("q2a", "Imediatamente", 30), opt("q2b", "Em até 3 meses", 25), opt("q2c", "De 3 a 6 meses", 15), opt("q2d", "Só pesquisando", 5)] },
  { id: "q3", label: "Como pretende pagar?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false, showIf: null,
    options: [opt("q3a", "À vista", 25), opt("q3b", "Financiamento", 15), opt("q3c", "Consórcio", 10), opt("q3d", "Ainda não sei", 0)] },
  { id: "q4", label: "Possui valor de entrada?", type: "YES_NO", required: true, isVisitIntent: false, showIf: null,
    options: [opt("q4a", "Sim", 20), opt("q4b", "Não", 0)] },
  { id: "q5", label: "Gostaria de agendar uma visita?", type: "YES_NO", required: true, isVisitIntent: true, showIf: null,
    options: [opt("q5a", "Sim", 25), opt("q5b", "Não", 0)] },
];

export const pick = (map: Record<string, string>) =>
  Object.fromEntries(Object.entries(map).map(([q, o]) => [q, { optionIds: [o] }]));
