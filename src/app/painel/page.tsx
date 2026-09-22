import { Check, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChannelBars } from "@/components/painel/ChannelBars";
import { formatDateTime } from "@/components/painel/lead-status";
import { StatCard } from "@/components/painel/StatCard";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { formatPercent } from "@/domain/format";
import { CLASSIFICATION_DISCLAIMER } from "@/domain/labels";
import { scoreOutOf100 } from "@/domain/scoring";
import { requireUser } from "@/server/auth/current";
import { getDashboard, type Dashboard } from "@/server/services/analytics";
import { getProfile } from "@/server/services/profile";

export const metadata: Metadata = { title: "Início" };

const PERIODS = [7, 30, 90] as const;
const number = new Intl.NumberFormat("pt-BR");

export default async function PainelHome({ searchParams }: PageProps<"/painel">) {
  const user = await requireUser();
  const dias = Number((await searchParams).dias);
  const days = (PERIODS as readonly number[]).includes(dias) ? dias : 30;
  const [data, profile] = await Promise.all([getDashboard(user, days), getProfile(user)]);
  const firstName = user.name.trim().split(/\s+/)[0];

  if (data.properties.total === 0) {
    return <FirstRun firstName={firstName} hasWhatsapp={Boolean(profile.whatsapp)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight tracking-[-0.015em] text-ink">Olá, {firstName}</h1>
          <p className="mt-1 text-ink-muted">Como seus imóveis estão indo nos últimos {days} dias.</p>
        </div>
        <nav aria-label="Período" className="inline-flex rounded-control border border-line-strong bg-surface p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={p === 30 ? "/painel" : `/painel?dias=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={cn(
                "grid h-9 min-w-16 place-items-center rounded-[0.4rem] px-3 text-sm font-medium tabular-nums transition-colors",
                p === days ? "bg-brand text-on-brand" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {p} dias
            </Link>
          ))}
        </nav>
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Visitantes únicos" value={number.format(data.uniqueVisitors)} />
        <StatCard label="Contatos" value={number.format(data.leads)} />
        <StatCard label="Alta intenção" value={number.format(data.highIntent)} hint="indicada pelas respostas" />
        <StatCard label="Querem visitar" value={number.format(data.wantsVisit)} />
        <StatCard
          label="Aguardando atendimento"
          value={number.format(data.pendingNew)}
          hint={data.pendingNew > 0 ? "Ver contatos novos" : "Tudo em dia"}
          href="/painel/leads?status=NEW&complete=all"
          emphasis={data.pendingNew > 0}
        />
        <StatCard
          label="Imóveis publicados"
          value={
            <>
              {data.properties.published}
              <span className="text-xl text-ink-faint">/{data.properties.total}</span>
            </>
          }
          href="/painel/imoveis"
        />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Funil" description="Do primeiro acesso à conversa no WhatsApp.">
          <Funnel data={data} />
        </Card>
        <Card title="Contatos por origem">
          <ChannelBars data={data.byChannel} />
        </Card>
      </div>

      <Card
        title="Contatos de alta intenção recentes"
        description={CLASSIFICATION_DISCLAIMER}
        padded={false}
        actions={
          <Link href="/painel/leads?classification=HIGH" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            Ver todos
          </Link>
        }
      >
        {data.recentHighIntent.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-muted sm:px-6">Nenhum contato de alta intenção ainda.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.recentHighIntent.map((l) => {
              const score = scoreOutOf100(l.score, l.maxScore);
              return (
                <li key={l.id}>
                  <Link
                    href={`/painel/leads/${l.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-sunken sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{l.name}</p>
                      <p className="truncate text-sm text-ink-muted">{l.property.title}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {score !== null && <p className="text-sm font-medium text-intent-high tabular-nums">{score}/100</p>}
                      <p className="text-xs text-ink-muted tabular-nums">{formatDateTime(l.createdAt)}</p>
                    </div>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Quatro etapas; as barras são proporcionais à primeira (visitantes). */
function Funnel({ data }: { data: Dashboard }) {
  const steps = [
    { label: "Visitantes", value: data.uniqueVisitors },
    { label: "Contatos", value: data.leads, rate: data.rates.visitorToLead, rateLabel: "dos visitantes deixaram contato" },
    { label: "Questionário concluído", value: data.completeLeads, rate: data.rates.completion, rateLabel: "dos contatos concluíram" },
    { label: "WhatsApp", value: data.whatsappClicks, rate: data.rates.leadToWhatsapp, rateLabel: "dos que concluíram abriram o WhatsApp" },
  ];
  // normalmente é a primeira etapa; o máximo protege contra períodos sem visitas registradas
  const base = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-col">
          {s.rate !== undefined && (
            <p className="flex items-center gap-2 py-2 pl-3 text-xs text-ink-muted">
              <span aria-hidden className="h-4 border-l border-dashed border-line-strong" />
              <span className="font-semibold text-ink tabular-nums">{formatPercent(s.rate)}</span> {s.rateLabel}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink">{s.label}</span>
            <span className="font-display text-2xl leading-none text-ink tabular-nums">{number.format(s.value)}</span>
          </div>
          <div aria-hidden className="mt-1.5 h-3 rounded-full bg-surface-sunken">
            <div
              className={cn("h-full rounded-full", i === steps.length - 1 ? "bg-whatsapp" : "bg-brand")}
              style={{ width: `${Math.min(100, (s.value / base) * 100)}%`, opacity: i === steps.length - 1 ? 1 : 1 - i * 0.15 }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function FirstRun({ firstName, hasWhatsapp }: { firstName: string; hasWhatsapp: boolean }) {
  const steps = [
    {
      title: "Complete seu perfil",
      text: "O WhatsApp é obrigatório: é para ele que os contatos são encaminhados.",
      href: "/painel/perfil",
      cta: "Ir para o perfil",
      done: hasWhatsapp,
    },
    {
      title: "Cadastre um imóvel",
      text: "Título, preço, fotos e descrição.",
      href: "/painel/imoveis/novo",
      cta: "Cadastrar imóvel",
      done: false,
    },
    {
      title: "Publique e compartilhe o link",
      text: "Cada contato responde às suas perguntas antes de chegar no seu WhatsApp.",
      href: "/painel/imoveis",
      cta: "Ver imóveis",
      done: false,
    },
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-display text-[2rem] leading-tight tracking-[-0.015em] text-ink">Olá, {firstName}</h1>
        <p className="mt-1 text-ink-muted">Três passos para receber os primeiros contatos.</p>
      </header>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className="flex items-center gap-4 rounded-card border border-line/70 bg-surface p-4 shadow-card hover:border-line-strong sm:p-5"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full font-display text-lg",
                  s.done ? "bg-success-soft text-success" : "border border-line-strong text-ink",
                )}
              >
                {s.done ? <Check className="size-5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-medium", s.done ? "text-ink-muted line-through" : "text-ink")}>
                  {s.title}
                  {s.done && <span className="sr-only"> (concluído)</span>}
                </span>
                <span className="mt-0.5 block text-sm text-ink-muted">{s.text}</span>
              </span>
              <span className="hidden shrink-0 text-sm font-medium text-brand sm:block">{s.cta}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
