import { ChevronLeft, ChevronRight, SearchX, Share2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeadFilters } from "@/components/painel/LeadFilters";
import { LeadTable } from "@/components/painel/LeadTable";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { CLASSIFICATION_DISCLAIMER } from "@/domain/labels";
import { leadsPageHref, readLeadListParams, totalPages } from "@/lib/lead-list-params";
import { requireUser } from "@/server/auth/current";
import { listLeads } from "@/server/services/leads";
import { listProperties } from "@/server/services/properties";

export const metadata: Metadata = { title: "Contatos" };

export default async function LeadsPage({ searchParams }: PageProps<"/painel/leads">) {
  const user = await requireUser();
  const { raw, filters } = readLeadListParams(await searchParams);
  const [result, properties] = await Promise.all([listLeads(user, filters), listProperties(user)]);
  const { items, total, page, pageSize } = result;
  const pages = totalPages(total, pageSize);
  const hasFilters = Object.keys(raw).some((k) => k !== "page");
  // Sem resultados: distingue "nenhum contato ainda" de "nenhum com esses filtros".
  const everHadLeads = items.length > 0 || (await listLeads(user, { page: 1 })).total > 0;

  const pageHref = (p: number) => leadsPageHref(raw, p);

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
