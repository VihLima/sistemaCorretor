"use server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/current";
import { ValidationError } from "@/server/errors";
import { updateProfile, updateProfilePhoto } from "@/server/services/profile";

/** Perfil aparece no painel e nas páginas públicas dos imóveis. */
function revalidateProfile() {
  revalidatePath("/painel", "layout");
  revalidatePath("/imovel/[slug]", "page");
}

export async function updateProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    await updateProfile(user, Object.fromEntries(formData));
    revalidateProfile();
    return "Perfil salvo.";
  });
}

export async function uploadProfilePhotoAction(formData: FormData): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ValidationError({ photo: "Selecione uma imagem" });
    await updateProfilePhoto(user, { data: Buffer.from(await file.arrayBuffer()) });
    revalidateProfile();
    return "Foto atualizada.";
  });
}
