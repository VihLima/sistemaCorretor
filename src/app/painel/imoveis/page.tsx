import { Building2, ExternalLink, ImageOff, MapPin, Pencil, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PROPERTY_STATUS_TONES } from "@/components/painel/property-status";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBRL } from "@/domain/format";
import { PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS } from "@/domain/labels";
import { requireUser } from "@/server/auth/current";
import { listProperties } from "@/server/services/properties";

export const metadata: Metadata = { title: "Imóveis" };

export default async function ImoveisPage() {
  const user = await requireUser();
  const properties = await listProperties(user);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight tracking-[-0.015em] text-ink">Imóveis</h1>
          {properties.length > 0 && (
            <p className="mt-1 text-ink-muted">
              {properties.length} {properties.length === 1 ? "imóvel cadastrado" : "imóveis cadastrados"}
            </p>
          )}
        </div>
        {properties.length > 0 && (
          <Link href="/painel/imoveis/novo" className={buttonStyles()}>
            <Plus aria-hidden />
            Novo imóvel
          </Link>
        )}
      </header>

      {properties.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="Cadastre seu primeiro imóvel"
          text="Com fotos e descrição, você publica uma página com link e QR Code que qualifica cada contato antes de chegar no seu WhatsApp."
          action={
            <Link href="/painel/imoveis/novo" className={buttonStyles()}>
              <Plus aria-hidden />
              Cadastrar imóvel
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => {
            const cover = p.images[0];
            const leads = p._count.leads;
            return (
              <li key={p.id} className="flex flex-col overflow-hidden rounded-card border border-line/70 bg-surface shadow-card">
                <div className="relative">
                  <Link href={`/painel/imoveis/${p.id}`} className="group block aspect-[16/10] bg-surface-sunken" tabIndex={-1} aria-hidden>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- fotos do storage (local ou Supabase)
                      <img src={cover.url} alt="" loading="lazy" className="size-full object-cover transition-opacity group-hover:opacity-90" />
                    ) : (
                      <span className="grid size-full place-items-center text-ink-faint">
                        <span className="flex flex-col items-center gap-1.5 text-sm">
                          <ImageOff className="size-6" />
                          Sem fotos
                        </span>
                      </span>
                    )}
                  </Link>
                  <Badge tone={PROPERTY_STATUS_TONES[p.status]} className="absolute top-3 left-3 shadow-card">
                    {PROPERTY_STATUS_LABELS[p.status]}
                  </Badge>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted">{PROPERTY_TYPE_LABELS[p.type]}</p>
                    <h2 className="mt-0.5 line-clamp-2 font-medium text-ink">
                      <Link href={`/painel/imoveis/${p.id}`} className="hover:text-brand">
                        {p.title}
                      </Link>
                    </h2>
                    <p className="mt-1 flex items-center gap-1 truncate text-sm text-ink-muted">
                      <MapPin aria-hidden className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {p.neighborhood}, {p.city}
                      </span>
                    </p>
                  </div>

                  <div className="mt-auto flex items-baseline justify-between gap-3">
                    <p className="font-display text-xl text-ink tabular-nums">
                      {formatBRL(p.price)}
                      {p.purpose === "RENT" && <span className="font-sans text-sm text-ink-muted">/mês</span>}
                    </p>
                    <p className="flex shrink-0 items-center gap-1 text-sm text-ink-muted">
                      <Users aria-hidden className="size-3.5" />
                      {leads} {leads === 1 ? "contato" : "contatos"}
                    </p>
                  </div>

                  <div className="flex gap-2 border-t border-line pt-3">
                    <Link
                      href={`/painel/imoveis/${p.id}`}
                      className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "flex-1")}
                    >
                      <Pencil aria-hidden />
                      Editar
                    </Link>
                    {p.status === "PUBLISHED" && (
                      <a
                        href={`/imovel/${p.slug}`}
                        target="_blank"
                        rel="noopener"
                        className={cn(buttonStyles({ variant: "ghost", size: "sm" }), "flex-1")}
                      >
                        <ExternalLink aria-hidden />
                        Ver página
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
