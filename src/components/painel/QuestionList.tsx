"use client";
import { ArrowDown, ArrowUp, CalendarCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { deleteQuestionAction, moveQuestionAction } from "@/app/painel/questionario/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { CLASSIFICATION_DISCLAIMER, QUESTION_TYPE_LABELS } from "@/domain/labels";
import { HIGH_THRESHOLD, MEDIUM_THRESHOLD, questionMaxPoints } from "@/domain/scoring";
import type { QuestionType } from "@/domain/types";
import { initialFormState, type FormState } from "@/lib/form-state";
import { QuestionEditor, type EditorQuestion, type QuestionDraft } from "./QuestionEditor";

const maxPoints = (type: QuestionType, options: { weight: number }[]) =>
  questionMaxPoints({
    id: "",
    label: "",
    type,
    required: false,
    isVisitIntent: false,
    showIf: null,
    options: options.map((o, i) => ({ id: String(i), label: "", weight: o.weight })),
  });

const pts = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;

export type QuestionListProps = { questions: EditorQuestion[]; max: number };

/**
 * Lista das perguntas com ↑ ↓ Editar Excluir, o editor em linha e o painel "Como a pontuação funciona",
 * cuja pontuação máxima acompanha ao vivo o que está sendo editado.
 */
export function QuestionList({ questions, max }: QuestionListProps) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [state, setState] = useState<FormState>(initialFormState);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const onDraftChange = useCallback((d: QuestionDraft) => setDraft(d), []);

  const close = (message?: string) => {
    setEditing(null);
    setDraft(null);
    setState(message ? { status: "success", message } : initialFormState);
  };

  const run = (id: string, action: () => Promise<FormState>) => {
    setBusyId(id);
    setState(initialFormState);
    startTransition(async () => {
      const result = await action();
      startTransition(() => {
        if (result.status === "error") setState(result);
        setBusyId(null);
      });
    });
  };

  const onDelete = (q: EditorQuestion) => {
    if (!window.confirm(`Excluir a pergunta “${q.label}”? As respostas já recebidas continuam nos contatos.`)) return;
    run(q.id, () => deleteQuestionAction(q.id));
  };

  // pontuação máxima: perguntas salvas, trocando a que está em edição pelo rascunho
  const total =
    questions.reduce((sum, q) => (q.id === editing && draft ? sum : sum + maxPoints(q.type, q.options)), 0) +
    (draft ? maxPoints(draft.type, draft.options) : 0);
  const highFrom = Math.ceil(total * HIGH_THRESHOLD);
  const mediumFrom = Math.ceil(total * MEDIUM_THRESHOLD);
  const full = questions.length >= max;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex flex-col gap-4">
        <FormMessage state={state} />

        <ol className="flex flex-col gap-3">
          {questions.map((q, i) =>
            editing === q.id ? (
              <li key={q.id}>
                <QuestionEditor question={q} onCancel={() => close()} onSaved={close} onDraftChange={onDraftChange} />
              </li>
            ) : (
              <li key={q.id} className="rounded-card border border-line/70 bg-surface p-4 shadow-card sm:p-5">
                <div className="flex gap-3">
                  <span aria-hidden className="font-display text-xl leading-none text-ink-faint tabular-nums">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="font-medium text-pretty text-ink">
                      <span className="sr-only">Pergunta {i + 1}: </span>
                      {q.label}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-ink-muted">{QUESTION_TYPE_LABELS[q.type]}</span>
                      {q.required && <Badge>Obrigatória</Badge>}
                      {q.isVisitIntent && (
                        <Badge tone="info" icon={<CalendarCheck aria-hidden />}>
                          Indica visita
                        </Badge>
                      )}
                    </div>
                    {q.options.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5" aria-label="Opções e pesos">
                        {q.options.map((o) => (
                          <li
                            key={o.id}
                            className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-muted"
                          >
                            {o.label} <span className="text-ink-faint">·</span>{" "}
                            <span className="font-medium text-ink tabular-nums">{pts(o.weight)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-ink-muted">
                      {q.options.length > 0 ? `Vale até ${pts(maxPoints(q.type, q.options))}` : "Não entra na pontuação"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(q.id, () => moveQuestionAction(q.id, "up"))}
                    disabled={pending || i === 0}
                    aria-label={`Mover “${q.label}” para cima`}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(q.id, () => moveQuestionAction(q.id, "down"))}
                    disabled={pending || i === questions.length - 1}
                    aria-label={`Mover “${q.label}” para baixo`}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setState(initialFormState);
                      setEditing(q.id);
                    }}
                    disabled={pending || editing !== null}
                    className="ml-auto"
                  >
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(q)}
                    disabled={pending || editing !== null}
                    aria-busy={(pending && busyId === q.id) || undefined}
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 aria-hidden />
                    Excluir
                  </Button>
                </div>
              </li>
            ),
          )}
          {editing === "new" && (
            <li>
              <QuestionEditor question={null} onCancel={() => close()} onSaved={close} onDraftChange={onDraftChange} />
            </li>
          )}
        </ol>

        {editing === null && (
          <div className="flex flex-col gap-1.5">
            <Button
              variant="secondary"
              onClick={() => {
                setState(initialFormState);
                setEditing("new");
              }}
              disabled={full || pending}
              className="self-start"
            >
              <Plus aria-hidden />
              Adicionar pergunta
            </Button>
            {full && <p className="text-sm text-ink-muted">Limite de {max} perguntas atingido. Exclua uma para adicionar outra.</p>}
          </div>
        )}
      </div>

      <aside
        aria-labelledby="pontuacao-titulo"
        className="rounded-card border border-line/70 bg-surface-sunken p-5 lg:sticky lg:top-10"
      >
        <h2 id="pontuacao-titulo" className="font-semibold text-ink">
          Como a pontuação funciona
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Somamos os pesos das respostas e dividimos pelo máximo possível das perguntas que a pessoa viu.
        </p>
        <p className="mt-4 text-sm text-ink-muted">Pontuação máxima</p>
        <p className="font-display text-4xl leading-tight text-ink tabular-nums" aria-live="polite">
          {pts(total)}
        </p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-ink">
              <span aria-hidden className="size-2.5 rounded-full bg-intent-high" />
              Alta: 60% ou mais
            </dt>
            <dd className="shrink-0 text-ink-muted tabular-nums">{total > 0 ? `a partir de ${pts(highFrom)}` : "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-ink">
              <span aria-hidden className="size-2.5 rounded-full bg-intent-medium" />
              Média: 30% ou mais
            </dt>
            <dd className="shrink-0 text-ink-muted tabular-nums">{total > 0 ? `a partir de ${pts(mediumFrom)}` : "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-ink">
              <span aria-hidden className="size-2.5 rounded-full bg-intent-low" />
              Baixa: abaixo de 30%
            </dt>
          </div>
        </dl>
        {total === 0 && (
          <p className="mt-3 text-sm text-ink-muted">Sem pesos, os contatos ficam “Sem classificação”.</p>
        )}
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">{CLASSIFICATION_DISCLAIMER}</p>
      </aside>
    </div>
  );
}
