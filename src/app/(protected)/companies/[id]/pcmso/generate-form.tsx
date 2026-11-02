"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { generatePcmsoDocumentAction } from "@/shared/server/actions/medicine/pcmso-documents";

import { FormError, SubmitButton, TextField } from "../../../_ui/form";

/** Gera e arquiva uma nova versão prévia do PCMSO a partir da data-base do ciclo de planejamento. */
export function GeneratePcmsoForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await generatePcmsoDocumentAction(companyId, {
        cycleStart: fd.get("cycleStart"),
      });
      if (result.ok) {
        setError(null);
        setFields({});
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.fields ? null : result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <TextField
        label="Data-base do ciclo de planejamento (12 meses, MED-14)"
        name="cycleStart"
        type="date"
        required
        error={fields.cycleStart}
      />
      <SubmitButton pending={pending} label="Gerar prévia do PCMSO" />
    </form>
  );
}
