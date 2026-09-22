"use client";
import { Camera } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { updateProfileAction, uploadProfilePhotoAction } from "@/app/painel/perfil/actions";
import { AgentCard } from "@/components/publico/AgentCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { formatBrPhone } from "@/domain/phone";
import { resizeImage } from "@/lib/image-resize";
import { initialFormState, type FormState } from "@/lib/form-state";

export type ProfileFormData = {
  name: string;
  whatsapp: string | null;
  phone: string | null;
  creci: string | null;
  agencyName: string | null;
  instagramUrl: string | null;
  bio: string | null;
  photoUrl: string | null;
};

type FieldName = "name" | "whatsapp" | "phone" | "creci" | "agencyName" | "instagramUrl" | "bio";
type Values = Record<FieldName, string>;

const phone = (v: string | null) => (v ? formatBrPhone(v) : "");

/** Mesma normalização do servidor, só para a prévia: "@usuario" vira o link do Instagram. */
function previewInstagram(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://instagram.com/${s.replace(/^@/, "")}`;
}

/**
 * Perfil do corretor + foto + prévia de como aparece na página do imóvel.
 * Campos controlados e envio por `onSubmit` + transição (o reset automático do React apagaria o que foi digitado).
 */
export function ProfileForm({ profile }: { profile: ProfileFormData }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialFormState);
  const [values, setValues] = useState<Values>({
    name: profile.name,
    whatsapp: phone(profile.whatsapp),
    phone: phone(profile.phone),
    creci: profile.creci ?? "",
    agencyName: profile.agencyName ?? "",
    instagramUrl: profile.instagramUrl ?? "",
    bio: profile.bio ?? "",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status !== "error") return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  };

  const bind = (name: FieldName) => ({
    name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((prev) => ({ ...prev, [name]: e.target.value })),
  });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <Card title="Foto">
          <PhotoUploader name={values.name} photoUrl={profile.photoUrl} />
        </Card>

        <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <Card title="Seus dados">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nome" error={errors.name} className="sm:col-span-2">
                <Input {...bind("name")} maxLength={100} autoComplete="name" />
              </Field>
              <Field
                label="WhatsApp"
                hint="Obrigatório para publicar imóveis. É para ele que os contatos são encaminhados."
                error={errors.whatsapp}
              >
                <Input {...bind("whatsapp")} type="tel" inputMode="tel" placeholder="(67) 99999-1234" autoComplete="tel" />
              </Field>
              <Field label="Telefone" optional error={errors.phone}>
                <Input {...bind("phone")} type="tel" inputMode="tel" autoComplete="off" />
              </Field>
              <Field label="CRECI" optional error={errors.creci}>
                <Input {...bind("creci")} maxLength={30} autoComplete="off" />
              </Field>
              <Field label="Imobiliária" optional error={errors.agencyName}>
                <Input {...bind("agencyName")} maxLength={100} autoComplete="organization" />
              </Field>
              <Field label="Instagram" optional hint="@usuario ou o link do perfil" error={errors.instagramUrl} className="sm:col-span-2">
                <Input {...bind("instagramUrl")} maxLength={200} autoComplete="off" autoCapitalize="none" />
              </Field>
              <Field label="Bio" optional error={errors.bio} aside={`${values.bio.length}/600`} className="sm:col-span-2">
                <Textarea
                  {...bind("bio")}
                  rows={4}
                  maxLength={600}
                  placeholder="Ex.: Especialista em casas no Jardim dos Estados há 10 anos."
                />
              </Field>
            </div>
          </Card>

          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <FormMessage state={state} className="sm:mr-auto" />
              <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined} className="w-full sm:w-auto">
                {pending && <Spinner label="Enviando" />}
                {pending ? "Salvando…" : "Salvar perfil"}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <Card title="Como aparece na página do imóvel" className="lg:sticky lg:top-10">
        <div className="rounded-control border border-line bg-canvas/50 p-4">
          <AgentCard
            agent={{
              name: values.name.trim() || "Seu nome",
              photoUrl: profile.photoUrl,
              creci: values.creci.trim() || null,
              agencyName: values.agencyName.trim() || null,
              bio: values.bio.trim() || null,
              instagramUrl: previewInstagram(values.instagramUrl),
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function PhotoUploader({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startUpload] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setState(initialFormState);
    startUpload(async () => {
      let blob: Blob;
      try {
        blob = await resizeImage(file, 800);
      } catch {
        setState({ status: "error", message: "Não foi possível ler esta imagem. Use uma foto JPG, PNG ou WebP." });
        return;
      }
      const fd = new FormData();
      fd.append("file", blob, "perfil.jpg");
      const result = await uploadProfilePhotoAction(fd);
      setState(result.status === "error" ? { status: "error", message: result.fieldErrors?.photo ?? result.message } : result);
    });
  };

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative size-24 shrink-0">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do storage (local ou Supabase)
          <img src={photoUrl} alt="Sua foto de perfil" className="size-24 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="grid size-24 place-items-center rounded-full bg-brand-soft font-display text-3xl text-brand">
            {initials || "?"}
          </span>
        )}
        {pending && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/40 text-white">
            <Spinner label="Enviando foto" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">Uma foto de rosto passa confiança. Ela é reduzida no seu aparelho antes do envio.</p>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="sr-only" id="foto-perfil" tabIndex={-1} />
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={pending} className="self-start">
          <Camera aria-hidden />
          {photoUrl ? "Trocar foto" : "Enviar foto"}
        </Button>
        <FormMessage state={state} />
      </div>
    </div>
  );
}
