import { ChevronLeft, ChevronRight, SearchX, Share2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeadFilters } from "@/components/painel/LeadFilters";
import { LeadTable } from "@/components/painel/LeadTable";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { CLASSIFICATION_DISCLAIMER } from "@/domain/labels";
import { requireUser } from "@/server/auth/current";
import { ValidationError } from "@/server/errors";
import { listLeads } from "@/server/services/leads";
import { listProperties } from "@/server/services/properties";

export const metadata: Metadata = { title: "Contatos" };

const FILTER_KEYS = ["propertyId", "classification", "status", "channel", "complete", "q", "days", "page"] as const;

/** Lê os filtros da URL. `complete=all` inclui incompletos; sem o parâmetro, só os que concluíram. */
function readFilters(sp: Record<string, string | string[] | undefined>) {
  const raw: Record<string, string> = {};
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s) raw[k] = s;
  }
  const { complete, ...rest } = raw;
  return { raw, service: { ...rest, complete: complete === "all" ? undefined : "yes" } };
}

async function safeList(user: Awaited<ReturnType<typeof requireUser>>, filters: Record<string, string | undefined>) {
  try {
    return await listLeads(user, filters);
  } catch (e) {
    // parâmetro inválido na URL (ex.: status digitado à mão): ignora os filtros em vez de quebrar
    if (e instanceof ValidationError) return listLeads(user, { complete: "yes" });
    throw e;
  }
}

export default async function LeadsPage({ searchParams }: PageProps<"/painel/leads">) {
  const user = await requireUser();
  const { raw, service } = readFilters(await searchParams);
  const [result, properties] = await Promise.all([safeList(user, service), listProperties(user)]);
  const { items, total, page, pageSize } = result;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Object.keys(raw).some((k) => k !== "page");
  // Sem resultados: distingue "nenhum contato ainda" de "nenhum com esses filtros".
  const everHadLeads = items.length > 0 || (await listLeads(user, { page: 1 })).total > 0;

  const pageHref = (p: number) => {
    const qs = new URLSearchParams(raw);
    if (p > 1) qs.set("page", String(p));
    else qs.delete("page");
    const s = qs.toString();
    return s ? `/painel/leads?${s}` : "/painel/leads";
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-[2rem] leading-tight tracking-[-0.015em] text-ink">Contatos</h1>
        <p className="mt-1 text-sm text-ink-muted">Classificação: {CLASSIFICATION_DISCLAIMER}</p>
      </header>

      {!everHadLeads ? (
        <EmptyState
          icon={<Users />}
          title="Nenhum contato ainda"
          text="Compartilhe o link de um imóvel para receber os primeiros contatos."
          action={
            <Link href="/painel/imoveis" className={buttonStyles()}>
              <Share2 aria-hidden />
              Ir para imóveis
            </Link>
          }
        />
      ) : (
        <>
          <LeadFilters properties={properties.map(({ id, title }) => ({ id, title }))} />

          {items.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title="Nenhum contato com esses filtros"
              text={raw.complete === "all" ? undefined : "Os contatos incompletos ficam ocultos até você marcar “Incluir incompletos”."}
              action={
                hasFilters ? (
                  <Link href="/painel/leads" className={buttonStyles({ variant: "secondary" })}>
                    Limpar filtros
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              <p className="-mb-3 text-sm text-ink-muted" aria-live="polite">
                {total} {total === 1 ? "contato" : "contatos"}
                {hasFilters && (
                  <>
                    {" "}
                    <Link href="/painel/leads" className="ml-1 font-medium text-brand underline-offset-4 hover:underline">
                      Limpar filtros
                    </Link>
                  </>
                )}
              </p>
              <LeadTable leads={items} />
            </>
          )}

          {pages > 1 && (
            <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
              <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
                <ChevronLeft aria-hidden />
                Anterior
              </PageLink>
              <span className="text-sm text-ink-muted tabular-nums">
                Página {page} de {pages}
              </span>
              <PageLink href={pageHref(page + 1)} disabled={page >= pages}>
                Próxima
                <ChevronRight aria-hidden />
              </PageLink>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const cls = buttonStyles({ variant: "secondary", size: "sm" });
  if (disabled) {
    return (
      <span aria-disabled className={cn(cls, "pointer-events-none opacity-55")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
