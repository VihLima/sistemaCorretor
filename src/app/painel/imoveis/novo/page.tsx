import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PropertyForm } from "@/components/painel/PropertyForm";
import { createPropertyAction } from "../actions";

export const metadata: Metadata = { title: "Novo imóvel" };

export default function NovoImovelPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <Link href="/painel/imoveis" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          Imóveis
        </Link>
        <h1 className="mt-2 font-display text-[2rem] leading-tight tracking-[-0.015em] text-ink">Novo imóvel</h1>
        <p className="mt-1 text-ink-muted">Preencha os dados principais. Depois você adiciona as fotos e publica.</p>
      </header>
      <PropertyForm action={createPropertyAction} submitLabel="Salvar e continuar" pendingLabel="Salvando…" />
    </div>
  );
}
