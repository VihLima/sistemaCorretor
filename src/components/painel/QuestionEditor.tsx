"use client";
import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { saveQuestionAction } from "@/app/painel/questionario/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { YES_NO_LABELS } from "@/domain/default-questionnaire";
import { QUESTION_TYPE_LABELS } from "@/domain/labels";
import { QUESTION_TYPES, type QuestionType } from "@/domain/types";
import { initialFormState, type FormState } from "@/lib/form-state";

export const MAX_OPTIONS = 12;

/** Pergunta como vem do servidor. */
export type EditorQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  isVisitIntent: boolean;
  options: { id: string; label: string; weight: number }[];
};

/** O que o editor em aberto representa agora (para a prévia da pontuação máxima). */
export type QuestionDraft = { type: QuestionType; options: { label: string; weight: number }[] };

type OptionRow = { key: string; id?: string; label: string; weight: string };

const isChoice = (t: QuestionType | "") => t === "SINGLE_CHOICE" || t === "MULTI_CHOICE";
const hasOptions = (t: QuestionType | "") => isChoice(t) || t === "YES_NO";
const toWeight = (w: string) => {
  const n = Number(w);
  return w.trim() === "" || Number.isNaN(n) ? 0 : n;
};

let keySeq = 0;
const newKey = () => `o${++keySeq}`;

function yesNoRows(prev: OptionRow[]): OptionRow[] {
  return YES_NO_LABELS.map((label, i) => ({ key: prev[i]?.key ?? newKey(), id: prev[i]?.id, label, weight: prev[i]?.weight ?? "0" }));
}

export type QuestionEditorProps = {
  /** Pergunta existente; `null` para uma nova. */
  question: EditorQuestion | null;
  onCancel: () => void;
  onSaved: (message?: string) => void;
  onDraftChange?: (draft: QuestionDraft) => void;
};

/**
 * Formulário da pergunta. Envia um objeto tipado (não FormData) por `onSubmit` + transição,
 * então nada é apagado quando o servidor devolve erros (chaves como `options.1.label`).
 */
export function QuestionEditor({ question, onCancel, onSaved, onDraftChange }: QuestionEditorProps) {
  const [label, setLabel] = useState(question?.label ?? "");
  const [type, setType] = useState<QuestionType | "">(question?.type ?? "");
  const [required, setRequired] = useState(question?.required ?? true);
  const [isVisitIntent, setIsVisitIntent] = useState(question?.isVisitIntent ?? false);
  const [options, setOptions] = useState<OptionRow[]>(
    () => question?.options.map((o) => ({ key: newKey(), id: o.id, label: o.label, weight: String(o.weight) })) ?? [],
  );
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const headingId = useId();
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("input, select")?.focus();
  }, []);

  useEffect(() => {
    if (state.status !== "error") return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);

  useEffect(() => {
    onDraftChange?.({
      type: type || "TEXT",
      options: hasOptions(type) ? options.map((o) => ({ label: o.label, weight: toWeight(o.weight) })) : [],
    });
  }, [type, options, onDraftChange]);

  const changeType = (next: QuestionType | "") => {
    setType(next);
    if (next === "YES_NO") setOptions((prev) => yesNoRows(prev));
    else if (isChoice(next)) {
      setOptions((prev) => {
        const rows = type === "YES_NO" ? prev.map((o) => ({ ...o })) : prev;
        const blanks = Array.from({ length: Math.max(0, 2 - rows.length) }, () => ({ key: newKey(), label: "", weight: "0" }));
        return [...rows, ...blanks];
      });
    }
  };

  const updateOption = (key: string, patch: Partial<OptionRow>) =>
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = {
      label,
      type: type as QuestionType,
      required,
      isVisitIntent,
      options: hasOptions(type) ? options.map((o) => ({ id: o.id, label: o.label, weight: toWeight(o.weight) })) : [],
    };
    startTransition(async () => {
      const result = await saveQuestionAction(question?.id ?? null, input);
      // depois de um await, as atualizações precisam de outra transição para entrarem junto com a lista revalidada
      startTransition(() => {
        if (result.status === "success") onSaved(result.message);
        else setState(result);
      });
    });
  };

  const formError: FormState =
    state.status === "error"
      ? { status: "error", message: errors._form ?? errors.options ?? state.message }
      : initialFormState;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-card border border-brand/40 bg-surface p-5 shadow-raised sm:p-6"
    >
      <h3 id={headingId} className="font-display text-xl text-ink">
        {question ? "Editar pergunta" : "Nova pergunta"}
      </h3>

      <Field label="Pergunta" error={errors.label} aside={`${label.length}/200`}>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} placeholder="Ex.: Quantos quartos você precisa?" autoComplete="off" />
      </Field>

      <Field label="Tipo de resposta" error={errors.type}>
        <Select
          value={type}
          onChange={(e) => changeType(e.target.value as QuestionType | "")}
          placeholder="Selecione"
          options={QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
        />
      </Field>

      <div className="flex flex-col">
        <Checkbox
          label="Obrigatória"
          hint="A pessoa só avança depois de responder."
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <Checkbox
          label="Esta pergunta indica interesse em visita"
          hint="Responder “Sim” ou uma opção com peso marca o contato como “Quer visitar”."
          checked={isVisitIntent}
          onChange={(e) => setIsVisitIntent(e.target.checked)}
        />
      </div>

      {hasOptions(type) && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-ink">
            {type === "YES_NO" ? "Pesos das respostas" : "Opções e pesos"}
            <span className="ml-1.5 font-normal text-ink-muted">peso de 0 a 100</span>
          </legend>
          {options.map((o, i) => (
            <div key={o.key} className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                {type === "YES_NO" ? (
                  <p className="flex h-11 min-w-0 flex-1 items-center rounded-control bg-surface-sunken px-3.5 text-[0.9375rem] text-ink">
                    {o.label}
                  </p>
                ) : (
                  <Input
                    value={o.label}
                    onChange={(e) => updateOption(o.key, { label: e.target.value })}
                    maxLength={100}
                    placeholder={`Opção ${i + 1}`}
                    aria-label={`Texto da opção ${i + 1}`}
                    invalid={Boolean(errors[`options.${i}.label`])}
                    className="min-w-0"
                  />
                )}
                <div className="relative w-24 shrink-0">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={o.weight}
                    onChange={(e) => updateOption(o.key, { weight: e.target.value })}
                    aria-label={`Peso de ${o.label || `opção ${i + 1}`}`}
                    invalid={Boolean(errors[`options.${i}.weight`])}
                    className="pr-9 tabular-nums"
                  />
                  <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-faint">
                    pts
                  </span>
                </div>
                {type !== "YES_NO" && (
                  <Button
                    variant="ghost"
                    onClick={() => setOptions((prev) => prev.filter((p) => p.key !== o.key))}
                    aria-label={`Remover ${o.label || `opção ${i + 1}`}`}
                    className="w-11 px-0"
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </div>
              {(errors[`options.${i}.label`] || errors[`options.${i}.weight`]) && (
                <p className="text-sm text-danger">{errors[`options.${i}.label`] ?? errors[`options.${i}.weight`]}</p>
              )}
            </div>
          ))}
          {type !== "YES_NO" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOptions((prev) => [...prev, { key: newKey(), label: "", weight: "0" }])}
              disabled={options.length >= MAX_OPTIONS}
              className="self-start"
            >
              <Plus aria-hidden />
              Adicionar opção
            </Button>
          )}
        </fieldset>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end">
        <FormMessage state={formError} className="sm:mr-auto" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            {pending && <Spinner label="Salvando" />}
            {pending ? "Salvando…" : "Salvar pergunta"}
          </Button>
        </div>
      </div>
    </form>
  );
}
