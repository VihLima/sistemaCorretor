"use client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { CHANNEL_LABELS, CLASSIFICATION_LABELS, LEAD_STATUS_LABELS } from "@/domain/labels";
import { CHANNELS, CLASSIFICATIONS, LEAD_STATUSES } from "@/domain/types";

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

/** Filtros que ficam na folha "Filtros" do celular (a busca fica sempre visível). */
const SHEET_KEYS = ["propertyId", "classification", "status", "channel", "days", "complete"] as const;

export type LeadFiltersProps = { properties: { id: string; title: string }[] };

/**
 * Busca (300 ms) + filtros refletidos na URL. No celular os selects ficam numa folha inferior "Filtros";
 * a partir de 1024px aparecem em linha. Qualquer mudança volta para a página 1.
 * `complete=all` inclui os contatos incompletos (por padrão só os que concluíram o questionário).
 */
export function LeadFilters({ properties }: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const sheetTitle = useRef<HTMLHeadingElement>(null);

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // A URL mudou por fora (ex.: "Limpar filtros", voltar do navegador): o campo acompanha.
  const urlQ = params.get("q") ?? "";
  const [seenUrlQ, setSeenUrlQ] = useState(urlQ);
  const [requestedQ, setRequestedQ] = useState(urlQ);
  if (urlQ !== seenUrlQ) {
    setSeenUrlQ(urlQ);
    // se foi a própria busca que mudou a URL, não sobrescreve o que ainda está sendo digitado
    if (urlQ !== requestedQ) {
      setRequestedQ(urlQ);
      setQ(urlQ);
    }
  }

  // busca com atraso de 300 ms; só navega se o texto difere do que está na URL
  useEffect(() => {
    if (q.trim() === urlQ) return;
    const t = setTimeout(() => {
      setRequestedQ(q.trim());
      apply({ q: q.trim() || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `apply` é recriada a cada render
  }, [q, urlQ]);

  useEffect(() => {
    if (!open) return;
    sheetTitle.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const activeCount = SHEET_KEYS.filter((k) => params.get(k)).length;
  const bindSelect = (key: string) => ({
    value: params.get(key) ?? "",
    onChange: (e: ChangeEvent<HTMLSelectElement>) => apply({ [key]: e.target.value || null }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou telefone"
            aria-label="Buscar por nome ou telefone"
            maxLength={100}
            className="pl-10"
          />
          {pending && (
            <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-faint">
              <Spinner label="Atualizando" />
            </span>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="filtros-contatos"
          className="lg:hidden"
        >
          <SlidersHorizontal aria-hidden />
          Filtros
          {activeCount > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-brand text-xs text-on-brand tabular-nums">
              <span className="sr-only">(</span>
              {activeCount}
              <span className="sr-only"> ativos)</span>
            </span>
          )}
        </Button>
      </div>

      {open && <div aria-hidden className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div
        id="filtros-contatos"
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-labelledby={open ? "filtros-titulo" : undefined}
        className={cn(
          open
            ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-panel bg-surface px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-raised"
            : "hidden",
          "lg:static lg:z-auto lg:flex lg:max-h-none lg:flex-row lg:flex-wrap lg:items-end lg:gap-3 lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none",
        )}
      >
        <div className="flex items-center justify-between lg:hidden">
          <h2 id="filtros-titulo" ref={sheetTitle} tabIndex={-1} className="font-display text-xl text-ink outline-none">
            Filtros
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Fechar filtros">
            <X aria-hidden />
          </Button>
        </div>

        <Field label="Imóvel" className="lg:w-56">
          <Select
            {...bindSelect("propertyId")}
            placeholder="Todos os imóveis"
            options={properties.map((p) => ({ value: p.id, label: p.title }))}
          />
        </Field>
        <Field label="Classificação" className="lg:w-44">
          <Select
            {...bindSelect("classification")}
            placeholder="Todas"
            options={CLASSIFICATIONS.map((c) => ({ value: c, label: CLASSIFICATION_LABELS[c] }))}
          />
        </Field>
        <Field label="Status" className="lg:w-40">
          <Select
            {...bindSelect("status")}
            placeholder="Todos"
            options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))}
          />
        </Field>
        <Field label="Origem" className="lg:w-36">
          <Select {...bindSelect("channel")} placeholder="Todas" options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))} />
        </Field>
        <Field label="Período" className="lg:w-40">
          <Select {...bindSelect("days")} placeholder="Todo o período" options={PERIODS} />
        </Field>
        <Checkbox
          label="Incluir incompletos"
          hint={<span className="lg:hidden">Quem deixou o contato mas não terminou as perguntas.</span>}
          checked={params.get("complete") === "all"}
          onChange={(e) => apply({ complete: e.target.checked ? "all" : null })}
        />

        <Button block size="lg" onClick={() => setOpen(false)} className="mt-1 lg:hidden">
          Ver resultados
        </Button>
      </div>
    </div>
  );
}
