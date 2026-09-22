import { ArrowLeft, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeletePropertyButton } from "@/components/painel/DeletePropertyButton";
import { PhotoManager } from "@/components/painel/PhotoManager";
import { PropertyForm } from "@/components/painel/PropertyForm";
import { SharePanel } from "@/components/painel/SharePanel";
import { StatusControl } from "@/components/painel/StatusControl";
import { Card } from "@/components/ui/Card";
import { formatBRL } from "@/domain/format";
import { PROPERTY_TYPE_LABELS } from "@/domain/labels";
import { getAppUrl } from "@/lib/app-url";
import { requireUser } from "@/server/auth/current";
import { NotFoundError } from "@/server/errors";
import { getProperty } from "@/server/services/properties";
import { updatePropertyAction } from "../actions";

export const metadata: Metadata = { title: "Imóvel" };

async function loadProperty(id: string) {
  const user = await requireUser();
  try {
    return await getProperty(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

export default async function ImovelPage({ params, searchParams }: PageProps<"/painel/imoveis/[id]">) {
  const { id } = await params;
  const { novo } = await searchParams;
  const property = await loadProperty(id);
  const publicUrl = `${await getAppUrl()}/imovel/${property.slug}`;
  const isNew = novo === "1" && property.status === "DRAFT";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <Link href="/painel/imoveis" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          Imóveis
        </Link>
        <h1 className="mt-2 font-display text-[2rem] leading-tight tracking-[-0.015em] text-pretty text-ink">
          {property.title}
        </h1>
        <p className="mt-1 text-ink-muted">
          {PROPERTY_TYPE_LABELS[property.type]} · {property.neighborhood}, {property.city} ·{" "}
          <span className="tabular-nums">
            {formatBRL(property.price)}
            {property.purpose === "RENT" && "/mês"}
          </span>
        </p>
      </header>

      {isNew && (
        <p role="status" className="flex items-start gap-2.5 rounded-card bg-brand-soft px-4 py-3 text-sm text-ink">
          <PartyPopper aria-hidden className="mt-px size-4 shrink-0 text-brand" />
          <span>
            <strong className="font-semibold">Imóvel cadastrado.</strong> Agora adicione as fotos e publique para gerar o link e o QR Code.
          </span>
        </p>
      )}

      <Card title="Status">
        <StatusControl propertyId={property.id} status={property.status} purpose={property.purpose} />
      </Card>

      {property.status === "PUBLISHED" && (
        <Card title="Divulgar" description="Compartilhe o link nas redes ou imprima o QR Code.">
          <SharePanel propertyId={property.id} publicUrl={publicUrl} />
        </Card>
      )}

      <div id="fotos" className="scroll-mt-20">
        <Card title="Fotos">
          <PhotoManager propertyId={property.id} images={property.images.map(({ id, url }) => ({ id, url }))} />
        </Card>
      </div>

      <section aria-labelledby="dados" className="flex flex-col gap-4">
        <h2 id="dados" className="mt-2 font-display text-2xl text-ink">
          Dados do imóvel
        </h2>
        <PropertyForm
          action={updatePropertyAction.bind(null, property.id)}
          property={property}
          submitLabel="Salvar alterações"
          pendingLabel="Salvando…"
          nested
        />
      </section>

      <Card title="Excluir imóvel" description="Apaga o imóvel, as fotos e a página. Imóveis com contatos não podem ser excluídos — marque como vendido, alugado ou pausado." className="border-danger/25">
        <DeletePropertyButton propertyId={property.id} />
      </Card>
    </div>
  );
}
