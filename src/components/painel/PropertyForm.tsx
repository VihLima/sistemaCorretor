"use client";
import { startTransition, useActionState, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { PROPERTY_PURPOSE_LABELS, PROPERTY_TYPE_LABELS } from "@/domain/labels";
import { PROPERTY_PURPOSES, PROPERTY_TYPES } from "@/domain/types";
import { initialFormState, type FormState } from "@/lib/form-state";

/** Campos do imóvel como vêm do banco (edição). */
export type PropertyFormData = {
  title: string;
  type: string;
  purpose: string;
  price: number;
  condoFee: number | null;
  iptu: number | null;
  city: string;
  neighborhood: string;
  address: string | null;
  showAddress: boolean;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  builtArea: number | null;
  landArea: number | null;
  description: string;
  highlights: string[];
  financingInfo: string | null;
};

type TextFieldName = Exclude<keyof PropertyFormData, "showAddress">;
type Values = Record<TextFieldName, string>;

const grouping = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
/** Mantém só dígitos e agrupa milhares enquanto o corretor digita: "450000" → "450.000". */
const formatMoneyInput = (raw: string) => {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10);
  return digits ? grouping.format(Number(digits)) : "";
};
const money = (v: number | null) => (v === null ? "" : grouping.format(v));
const count = (v: number | null) => (v === null ? "" : String(v));
const area = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

function toValues(p?: PropertyFormData): Values {
  return {
    title: p?.title ?? "",
    type: p?.type ?? "",
    purpose: p?.purpose ?? "",
    price: p ? money(p.price) : "",
    condoFee: money(p?.condoFee ?? null),
    iptu: money(p?.iptu ?? null),
    city: p?.city ?? "",
    neighborhood: p?.neighborhood ?? "",
    address: p?.address ?? "",
    bedrooms: count(p?.bedrooms ?? null),
    suites: count(p?.suites ?? null),
    bathrooms: count(p?.bathrooms ?? null),
    parkingSpots: count(p?.parkingSpots ?? null),
    builtArea: area(p?.builtArea ?? null),
    landArea: area(p?.landArea ?? null),
    description: p?.description ?? "",
    highlights: p?.highlights.join("\n") ?? "",
    financingInfo: p?.financingInfo ?? "",
  };
}

const MONEY_FIELDS = new Set<TextFieldName>(["price", "condoFee", "iptu"]);
const COUNT_FIELDS = new Set<TextFieldName>(["bedrooms", "suites", "bathrooms", "parkingSpots"]);

export type PropertyFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Imóvel existente (edição); omitido no cadastro. */
  property?: PropertyFormData;
  submitLabel: string;
  pendingLabel: string;
  /** Títulos das seções como h3 quando o formulário fica dentro de outra seção da página. */
  nested?: boolean;
};

/**
 * Cadastro/edição do imóvel. Campos controlados e envio via `onSubmit` + transição: assim o React
 * não reinicia o formulário após a action (o reset automático limpava selects e o checkbox,
 * perdendo o que foi digitado quando havia erro de validação). `action` fica como fallback sem JS.
 */
export function PropertyForm({ action, property, submitLabel, pendingLabel, nested }: PropertyFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [values, setValues] = useState<Values>(() => toValues(property));
  const [showAddress, setShowAddress] = useState(property?.showAddress ?? false);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};
  const titleAs = nested ? "h3" : "h2";

  // leva o foco ao primeiro campo com erro (o formulário é longo, principalmente no celular)
  useEffect(() => {
    if (state.status !== "error") return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  };

  const bind = (name: TextFieldName) => ({
    name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      let v = e.target.value;
      if (MONEY_FIELDS.has(name)) v = formatMoneyInput(v);
      else if (COUNT_FIELDS.has(name)) v = v.replace(/\D/g, "").slice(0, 2);
      setValues((prev) => ({ ...prev, [name]: v }));
    },
  });

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Card title="Básico" titleAs={titleAs}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Título do anúncio" hint="Ex.: Casa com 3 quartos e piscina no Jardim dos Estados" error={errors.title} className="sm:col-span-2">
            <Input {...bind("title")} maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Tipo" error={errors.type}>
            <Select {...bind("type")} placeholder="Selecione" options={PROPERTY_TYPES.map((t) => ({ value: t, label: PROPERTY_TYPE_LABELS[t] }))} />
          </Field>
          <Field label="Finalidade" error={errors.purpose}>
            <Select {...bind("purpose")} placeholder="Selecione" options={PROPERTY_PURPOSES.map((p) => ({ value: p, label: PROPERTY_PURPOSE_LABELS[p] }))} />
          </Field>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Field label={values.purpose === "RENT" ? "Aluguel (R$/mês)" : "Preço (R$)"} error={errors.price}>
            <Input {...bind("price")} inputMode="numeric" placeholder="450.000" autoComplete="off" />
          </Field>
          <Field label="Condomínio (R$/mês)" optional error={errors.condoFee}>
            <Input {...bind("condoFee")} inputMode="numeric" autoComplete="off" />
          </Field>
          <Field label="IPTU (R$/ano)" optional error={errors.iptu}>
            <Input {...bind("iptu")} inputMode="numeric" autoComplete="off" />
          </Field>
        </div>
      </Card>

      <Card title="Localização" titleAs={titleAs}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Cidade" error={errors.city}>
            <Input {...bind("city")} autoComplete="address-level2" />
          </Field>
          <Field label="Bairro" error={errors.neighborhood}>
            <Input {...bind("neighborhood")} autoComplete="address-level3" />
          </Field>
          <Field label="Endereço" optional hint="Rua e número. Fica oculto na página, a menos que você marque a opção abaixo." error={errors.address} className="sm:col-span-2">
            <Input {...bind("address")} autoComplete="street-address" />
          </Field>
        </div>
        <Checkbox
          name="showAddress"
          checked={showAddress}
          onChange={(e) => setShowAddress(e.target.checked)}
          label="Mostrar endereço completo na página"
          hint="Desmarcado, a página mostra só o bairro e a cidade."
          className="mt-2"
        />
      </Card>

      <Card title="Características" titleAs={titleAs}>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <Field optional label="Quartos" error={errors.bedrooms}>
            <Input {...bind("bedrooms")} inputMode="numeric" autoComplete="off" />
          </Field>
          <Field optional label="Suítes" error={errors.suites}>
            <Input {...bind("suites")} inputMode="numeric" autoComplete="off" />
          </Field>
          <Field optional label="Banheiros" error={errors.bathrooms}>
            <Input {...bind("bathrooms")} inputMode="numeric" autoComplete="off" />
          </Field>
          <Field optional label="Vagas" error={errors.parkingSpots}>
            <Input {...bind("parkingSpots")} inputMode="numeric" autoComplete="off" />
          </Field>
          <Field label="Área construída (m²)" optional error={errors.builtArea} className="col-span-2">
            <Input {...bind("builtArea")} inputMode="decimal" autoComplete="off" />
          </Field>
          <Field label="Área do terreno (m²)" optional error={errors.landArea} className="col-span-2">
            <Input {...bind("landArea")} inputMode="decimal" autoComplete="off" />
          </Field>
        </div>
      </Card>

      <Card title="Descrição" titleAs={titleAs}>
        <div className="flex flex-col gap-5">
          <Field label="Descrição" error={errors.description} aside={`${values.description.length}/5000`}>
            <Textarea {...bind("description")} rows={7} maxLength={5000} />
          </Field>
          <Field label="Diferenciais" optional hint="Um por linha. Ex.: Piscina aquecida" error={errors.highlights}>
            <Textarea {...bind("highlights")} rows={5} />
          </Field>
          <Field label="Financiamento" optional hint="Ex.: Aceita financiamento bancário e FGTS." error={errors.financingInfo}>
            <Textarea {...bind("financingInfo")} rows={3} maxLength={1000} />
          </Field>
        </div>
      </Card>

      {/* barra de salvar: fixa acima da navegação inferior no celular, estática no desktop */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <FormMessage state={state} className="sm:mr-auto" />
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined} className="w-full sm:w-auto">
            {pending && <Spinner label="Enviando" />}
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

