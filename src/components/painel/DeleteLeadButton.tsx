"use client";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteLeadAction } from "@/app/painel/leads/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Spinner } from "@/components/ui/Spinner";
import { initialFormState, type FormState } from "@/lib/form-state";

/** Exclusão definitiva do contato (pedido de remoção de dados — LGPD), com confirmação. */
export function DeleteLeadButton({ leadId, name }: { leadId: string; name: string }) {
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (!window.confirm(`Excluir o contato de ${name}? Respostas, observações e histórico serão apagados. Não é possível desfazer.`)) return;
    startTransition(async () => {
      setState(await deleteLeadAction(leadId));
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Button variant="danger" onClick={onDelete} disabled={pending} aria-busy={pending || undefined} className="self-start">
        {pending ? <Spinner label="Excluindo" /> : <Trash2 aria-hidden />}
        Excluir contato
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
