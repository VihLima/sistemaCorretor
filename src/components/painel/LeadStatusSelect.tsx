"use client";
import { useOptimistic, useState, useTransition } from "react";
import { updateLeadStatusAction } from "@/app/painel/leads/actions";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { LEAD_STATUS_LABELS } from "@/domain/labels";
import { LEAD_STATUSES, type LeadStatus } from "@/domain/types";

/** Status do atendimento. Muda na hora (otimista) e volta ao valor anterior se o servidor recusar. */
export function LeadStatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const onChange = (next: LeadStatus) => {
    setError(undefined);
    startTransition(async () => {
      setOptimistic(next);
      const result = await updateLeadStatusAction(leadId, next);
      if (result.status === "error") setError(result.message);
    });
  };

  return (
    <Field
      label={
        <span className="inline-flex items-center gap-2">
          Status do atendimento
          {pending && <Spinner label="Salvando" />}
        </span>
      }
      error={error}
      className="w-full sm:w-60"
    >
      <Select
        value={optimistic}
        onChange={(e) => onChange(e.target.value as LeadStatus)}
        options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))}
      />
    </Field>
  );
}
