"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { addLeadNoteAction } from "@/app/painel/leads/actions";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import { initialFormState } from "@/lib/form-state";

/** Nova observação sobre o contato. Só tem um campo de texto: o reset automático do formulário após salvar é desejado. */
export function NoteForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useActionState(addLeadNoteAction.bind(null, leadId), initialFormState);
  const [length, setLength] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} onReset={() => setLength(0)} className="flex flex-col gap-3">
      <Field label="Nova observação" error={state.fieldErrors?._form} aside={`${length}/2000`}>
        <Textarea
          name="body"
          rows={3}
          maxLength={2000}
          required
          placeholder="Ex.: Prefere visitar no sábado de manhã."
          onChange={(e) => setLength(e.target.value.length)}
        />
      </Field>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FormMessage state={state.fieldErrors?._form ? initialFormState : state} />
        <SubmitButton variant="secondary" pendingLabel="Salvando…" className="sm:ml-auto">
          Salvar observação
        </SubmitButton>
      </div>
    </form>
  );
}
