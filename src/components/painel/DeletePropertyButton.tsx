"use client";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deletePropertyAction } from "@/app/painel/imoveis/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Spinner } from "@/components/ui/Spinner";
import { initialFormState, type FormState } from "@/lib/form-state";

/** Exclusão com confirmação. Imóveis com contatos são bloqueados pelo serviço (mensagem exibida aqui). */
export function DeletePropertyButton({ propertyId }: { propertyId: string }) {
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (!window.confirm("Excluir este imóvel? As fotos e a página serão apagadas e o link deixará de funcionar.")) return;
    startTransition(async () => {
      setState(await deletePropertyAction(propertyId));
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Button variant="danger" onClick={onDelete} disabled={pending} aria-busy={pending || undefined} className="self-start">
        {pending ? <Spinner label="Excluindo" /> : <Trash2 aria-hidden />}
        Excluir imóvel
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
