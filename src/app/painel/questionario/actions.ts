"use server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import type { QuestionInput } from "@/lib/validation/question";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/current";
import { createQuestion, deleteQuestion, moveQuestion, updateQuestion } from "@/server/services/questionnaires";

export async function saveQuestionAction(id: string | null, input: QuestionInput): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    if (id) await updateQuestion(user, id, input);
    else await createQuestion(user, input);
    revalidatePath("/painel/questionario");
    return id ? "Pergunta salva." : "Pergunta adicionada.";
  });
}

export async function deleteQuestionAction(id: string): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    await deleteQuestion(user, id);
    revalidatePath("/painel/questionario");
  });
}

export async function moveQuestionAction(id: string, dir: "up" | "down"): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    await moveQuestion(user, id, dir);
    revalidatePath("/painel/questionario");
  });
}
