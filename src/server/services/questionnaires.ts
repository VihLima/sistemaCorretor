import { DEFAULT_QUESTIONNAIRE } from "@/domain/default-questionnaire";
import type { Tx } from "@/server/db";

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
