"use client";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setStatusAction } from "@/app/painel/imoveis/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PROPERTY_STATUS_LABELS } from "@/domain/labels";
import type { PropertyPurpose, PropertyStatus } from "@/domain/types";
import { initialFormState, type FormState } from "@/lib/form-state";
import { PROPERTY_STATUS_TONES } from "./property-status";

const EXPLANATIONS: Record<PropertyStatus, string> = {
  DRAFT: "Só você vê este imóvel. Publique para gerar o link e o QR Code.",
  PUBLISHED: "A página está no ar e recebendo contatos.",
  PAUSED: "A página está fora do ar. Os contatos já recebidos continuam no painel.",
  SOLD: "A página continua no ar, mostrando o imóvel como vendido.",
  RENTED: "A página continua no ar, mostrando o imóvel como alugado.",
};

type StatusButton = { to: PropertyStatus; label: string; variant: ButtonVariant };

function buttonsFor(status: PropertyStatus, purpose: PropertyPurpose): StatusButton[] {
  switch (status) {
    case "DRAFT":
    case "PAUSED":
      return [{ to: "PUBLISHED", label: "Publicar", variant: "primary" }];
    case "PUBLISHED":
      return [
        { to: "PAUSED", label: "Pausar", variant: "secondary" },
        purpose === "RENT"
          ? { to: "RENTED", label: "Marcar como alugado", variant: "secondary" }
          : { to: "SOLD", label: "Marcar como vendido", variant: "secondary" },
      ];
    case "SOLD":
    case "RENTED":
      return [{ to: "PUBLISHED", label: "Republicar", variant: "primary" }];
  }
}

export type StatusControlProps = { propertyId: string; status: PropertyStatus; purpose: PropertyPurpose };

/** Status atual + ações possíveis a partir dele. Erros de publicação apontam para onde resolver. */
export function StatusControl({ propertyId, status, purpose }: StatusControlProps) {
  const [state, setState] = useState<FormState>(initialFormState);
  const [target, setTarget] = useState<PropertyStatus | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (to: PropertyStatus) => {
    setTarget(to);
    startTransition(async () => {
      setState(await setStatusAction(propertyId, to));
    });
  };

  const error = state.status === "error" ? state.message : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Badge tone={PROPERTY_STATUS_TONES[status]} className="self-start">
            {PROPERTY_STATUS_LABELS[status]}
          </Badge>
          <p className="text-sm text-ink-muted">{EXPLANATIONS[status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {buttonsFor(status, purpose).map((b) => (
            <Button
              key={b.to}
              variant={b.variant}
              disabled={pending}
              aria-busy={(pending && target === b.to) || undefined}
              onClick={() => change(b.to)}
              className="grow sm:grow-0"
            >
              {pending && target === b.to && <Spinner label="Salvando" />}
              {b.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
          <p>
            {error}{" "}
            {/WhatsApp/.test(error) && (
              <Link href="/painel/perfil" className="font-medium underline underline-offset-4">
                Ir para o perfil
              </Link>
            )}
            {/foto/.test(error) && (
              <a href="#fotos" className="font-medium underline underline-offset-4">
                Adicionar fotos
              </a>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
