import type { Metadata } from "next";
import { QuestionList } from "@/components/painel/QuestionList";
import { requireUser } from "@/server/auth/current";
import { getDefaultQuestionnaire, MAX_QUESTIONS } from "@/server/services/questionnaires";

export const metadata: Metadata = { title: "Questionário" };

export default async function QuestionarioPage() {
  const user = await requireUser();
  const questionnaire = await getDefaultQuestionnaire(user);
  const questions = questionnaire.questions.map((q) => ({
    id: q.id,
    label: q.label,
    type: q.type,
    required: q.required,
    isVisitIntent: q.isVisitIntent,
    options: q.options.map((o) => ({ id: o.id, label: o.label, weight: o.weight })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="max-w-2xl">
          <h1 className="font-display text-[2rem] leading-tight tracking-[-0.015em] text-ink">Questionário</h1>
          <p className="mt-1 text-pretty text-ink-muted">
            Este questionário aparece em todos os seus imóveis. Mantenha curto: 4–6 perguntas convertem melhor.
          </p>
        </div>
        <p className="text-sm text-ink-muted tabular-nums">
          <span className="font-display text-2xl text-ink">
            {questions.length}/{MAX_QUESTIONS}
          </span>{" "}
          perguntas
        </p>
      </header>
      <QuestionList questions={questions} max={MAX_QUESTIONS} />
    </div>
  );
}
