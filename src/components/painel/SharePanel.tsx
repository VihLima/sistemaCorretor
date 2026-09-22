"use client";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

const CHANNEL_LINKS = [
  { key: "instagram", label: "Instagram", hint: "Bio, stories e direct", query: "utm_source=instagram&utm_medium=social" },
  { key: "facebook", label: "Facebook", hint: "Posts, grupos e Marketplace", query: "utm_source=facebook&utm_medium=social" },
  { key: "google", label: "Google", hint: "Perfil da empresa no Google", query: "utm_source=google&utm_medium=organic" },
] as const;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // navegadores sem Clipboard API (ou fora de HTTPS)
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

export type SharePanelProps = {
  propertyId: string;
  /** URL absoluta da página pública (sem parâmetros). */
  publicUrl: string;
};

/** Link da página, variantes por canal (com UTM, para saber a origem dos contatos) e QR Code. */
export function SharePanel({ propertyId, publicUrl }: SharePanelProps) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (key: string, text: string) => {
    await copyText(text);
    setCopied(key);
  };

  const qrSrc = `/painel/imoveis/${propertyId}/qrcode`;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="public-url" className="text-sm font-medium text-ink">
            Link da página
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="public-url"
              data-testid="public-url"
              readOnly
              value={publicUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-control border border-line-strong bg-surface-sunken px-3.5 text-[0.9375rem] text-ink outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
            />
            <Button onClick={() => copy("direct", publicUrl)}>
              {copied === "direct" ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied === "direct" ? "Copiado" : "Copiar link"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium text-ink">Links por rede social</p>
            <p className="text-sm text-ink-muted">Use o link de cada lugar para saber de onde vieram os contatos.</p>
          </div>
          <ul className="flex flex-col gap-2">
            {CHANNEL_LINKS.map((c) => {
              const url = `${publicUrl}?${c.query}`;
              const isCopied = copied === c.key;
              return (
                <li key={c.key} className="flex items-center gap-3 rounded-control border border-line bg-surface-sunken py-2 pr-2 pl-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{c.label}</p>
                    <p className="truncate text-xs text-ink-muted" title={url}>
                      {c.hint}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copy(c.key, url)}
                    aria-label={isCopied ? `Link do ${c.label} copiado` : `Copiar link do ${c.label}`}
                  >
                    {isCopied ? <Check aria-hidden /> : <Copy aria-hidden />}
                    {isCopied ? "Copiado" : "Copiar"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>

        <a href={publicUrl} target="_blank" rel="noopener" className={cn(buttonStyles({ variant: "ghost" }), "self-start px-3")}>
          <ExternalLink aria-hidden />
          Abrir página
        </a>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface-sunken p-4 md:self-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG gerado sob demanda pela rota do painel */}
        <img src={qrSrc} alt="QR Code da página do imóvel" width={176} height={176} className="size-44 rounded-control bg-white" />
        <p className="text-center text-xs text-ink-muted">Para placas, panfletos e cartões. Contatos chegam marcados como QR Code.</p>
        <a href={`${qrSrc}?download=1`} download className={buttonStyles({ variant: "secondary", size: "sm", block: true })}>
          <Download aria-hidden />
          Baixar QR Code
        </a>
      </div>

      <p aria-live="polite" className="sr-only">
        {copied ? "Link copiado" : ""}
      </p>
    </div>
  );
}
