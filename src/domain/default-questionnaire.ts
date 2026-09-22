import type { QuestionType } from "./types";

export const YES_NO_LABELS = ["Sim", "Não"] as const;

export interface QuestionTemplate {
  label: string;
  type: QuestionType;
  required: boolean;
  isVisitIntent: boolean;
  options: { label: string; weight: number }[];
}

export const DEFAULT_QUESTIONNAIRE: QuestionTemplate[] = [
  { label: "Você pretende comprar ou alugar?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false,
    options: [{ label: "Comprar", weight: 0 }, { label: "Alugar", weight: 0 }, { label: "Ainda não sei", weight: 0 }] },
  { label: "Quando pretende fechar negócio?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false,
    options: [{ label: "Imediatamente", weight: 30 }, { label: "Em até 3 meses", weight: 25 }, { label: "De 3 a 6 meses", weight: 15 }, { label: "Só estou pesquisando", weight: 5 }] },
  { label: "Como pretende pagar?", type: "SINGLE_CHOICE", required: true, isVisitIntent: false,
    options: [{ label: "À vista", weight: 25 }, { label: "Financiamento", weight: 15 }, { label: "Consórcio", weight: 10 }, { label: "Ainda não sei", weight: 0 }] },
  { label: "Você possui valor de entrada?", type: "YES_NO", required: true, isVisitIntent: false,
    options: [{ label: "Sim", weight: 20 }, { label: "Não", weight: 0 }] },
  { label: "Gostaria de agendar uma visita?", type: "YES_NO", required: true, isVisitIntent: true,
    options: [{ label: "Sim", weight: 25 }, { label: "Não", weight: 0 }] },
];
