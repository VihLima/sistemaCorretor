"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeadStatus } from "@/domain/types";
import type { FormState } from "@/lib/form-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/current";
import { addLeadNote, deleteLead, updateLeadStatus } from "@/server/services/leads";

/** Lista, detalhe e dashboard (que mostra "aguardando atendimento"). */
function revalidateLead(id: string) {
  revalidatePath("/painel/leads");
  revalidatePath(`/painel/leads/${id}`);
  revalidatePath("/painel");
}

export async function updateLeadStatusAction(id: string, status: LeadStatus): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    await updateLeadStatus(user, id, status);
    revalidateLead(id);
  });
}

export async function addLeadNoteAction(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    await addLeadNote(user, id, String(formData.get("body") ?? ""));
    revalidatePath(`/painel/leads/${id}`);
    return "Observação salva.";
  });
}

export async function deleteLeadAction(id: string): Promise<FormState> {
  const user = await requireUser();
  let deleted = false;
  const state = await runAction(async () => {
    await deleteLead(user, id);
    revalidateLead(id);
    revalidatePath("/painel/imoveis");
    deleted = true;
  });
  if (deleted) redirect("/painel/leads");
  return state;
}
