import { MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { ClassificationBadge } from "@/components/ui/ClassificationBadge";
import { Wordmark } from "@/components/ui/Wordmark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        <Wordmark />
        <p className="mt-3 max-w-xs text-sm text-ink-muted lg:hidden">Transforme cliques em contatos qualificados.</p>
        <main className="flex flex-1 items-start py-10 sm:items-center">
          <div className="mx-auto w-full max-w-[24rem]">{children}</div>
        </main>
        <p className="text-xs text-ink-faint">Feito para corretores de imóveis.</p>
      </div>

      <aside
        aria-label="Como funciona"
        className="relative m-3 hidden flex-col justify-between overflow-hidden rounded-panel bg-brand p-12 text-on-brand lg:flex xl:p-16"
      >
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[34rem] rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-[26rem] rounded-full border border-white/10" />

        <div className="relative max-w-[30rem]">
          <h2 className="font-display text-[3.25rem] leading-[1.02] font-normal tracking-[-0.02em] text-balance">
            Transforme cliques em contatos qualificados.
          </h2>
          <p className="mt-6 max-w-[26rem] text-[1.0625rem] leading-relaxed text-white/80">
            Cada imóvel ganha uma página própria. Antes de chamar você no WhatsApp, o interessado responde a poucas
            perguntas — e você sabe com quem conversar primeiro.
          </p>
        </div>

        <figure className="relative mt-12 w-full max-w-[26rem] self-end">
          <div className="rounded-card bg-surface p-5 text-ink shadow-raised">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold">Juliana Prado</p>
                <p className="truncate text-sm text-ink-muted">Apartamento 3 quartos no Jardim dos Estados</p>
              </div>
              <span className="shrink-0 pt-0.5 text-sm text-ink-muted tabular-nums">82/100</span>
            </div>
            <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
              {[
                ["Como pretende pagar?", "Financiamento já aprovado"],
                ["Quando quer se mudar?", "Nos próximos 3 meses"],
                ["Quer agendar uma visita?", "Sim, neste fim de semana"],
              ].map(([q, a]) => (
                <div key={q} className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{q}</dt>
                  <dd className="text-right font-medium">{a}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-center justify-between gap-3">
              <ClassificationBadge value="HIGH" size="sm" />
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <MessageCircle aria-hidden className="size-3.5 text-whatsapp" />
                Chegou no seu WhatsApp às 14:32
              </span>
            </div>
          </div>
          <figcaption className="mt-3 text-right text-sm text-white/60">Exemplo de contato recebido</figcaption>
        </figure>
      </aside>
    </div>
  );
}
