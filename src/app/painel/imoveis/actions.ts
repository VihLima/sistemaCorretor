"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PropertyStatus } from "@/domain/types";
import type { FormState } from "@/lib/form-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { ValidationError } from "@/server/errors";
import {
  addPropertyImage,
  createProperty,
  deleteProperty,
  getProperty,
  removePropertyImage,
  reorderPropertyImages,
  setPropertyStatus,
  updateProperty,
} from "@/server/services/properties";

type Revalidatable = { id: string; slug: string; publishedAt: Date | null };

/** Lista, página de edição e — se o imóvel já foi publicado alguma vez — a página pública. */
function revalidateProperty(p: Revalidatable) {
  revalidatePath("/painel/imoveis");
  revalidatePath(`/painel/imoveis/${p.id}`);
  if (p.publishedAt) revalidatePath(`/imovel/${p.slug}`);
}

export async function createPropertyAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  let id: string | null = null;
  const state = await runAction(async () => {
    const property = await createProperty(user, Object.fromEntries(formData));
    id = property.id;
  });
  if (id) {
    revalidatePath("/painel/imoveis");
    redirect(`/painel/imoveis/${id}?novo=1`);
  }
  return state;
}

export async function updatePropertyAction(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    revalidateProperty(await updateProperty(user, id, Object.fromEntries(formData)));
    return "Alterações salvas.";
  });
}

export async function setStatusAction(id: string, status: PropertyStatus): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    revalidateProperty(await setPropertyStatus(user, id, status));
  });
}

export async function deletePropertyAction(id: string): Promise<FormState> {
  const user = await requireUser();
  let deleted = false;
  const state = await runAction(async () => {
    const property = await getProperty(user, id);
    await deleteProperty(user, id);
    revalidateProperty(property);
    deleted = true;
  });
  if (deleted) redirect("/painel/imoveis");
  return state;
}

export async function uploadImageAction(propertyId: string, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ValidationError({ file: "Selecione uma imagem" });
    await addPropertyImage(user, propertyId, { data: Buffer.from(await file.arrayBuffer()) });
    revalidateProperty(await getProperty(user, propertyId));
  });
}

export async function removeImageAction(imageId: string): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    // só para saber o que revalidar; o serviço refaz a checagem de conta
    const image = await db.propertyImage.findFirst({
      where: { id: imageId, property: { accountId: user.accountId } },
      select: { property: { select: { id: true, slug: true, publishedAt: true } } },
    });
    await removePropertyImage(user, imageId);
    if (image) revalidateProperty(image.property);
  });
}

export async function reorderImagesAction(propertyId: string, ids: string[]): Promise<FormState> {
  const user = await requireUser();
  return runAction(async () => {
    await reorderPropertyImages(user, propertyId, ids);
    revalidateProperty(await getProperty(user, propertyId));
  });
}
