"use client";

import type { FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import { generatePcmsoDocumentAction } from "@/shared/server/actions/medicine/pcmso-documents";

import { FormError, SubmitButton, TextField } from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

const describeGeneratePath = pathDescriber({
  fields: { cycleStart: "Data-base do ciclo de planejamento" },
});

/** Gera e arquiva uma nova versão prévia do PCMSO a partir da data-base do ciclo de planejamento. */
export function GeneratePcmsoForm({ companyId }: { companyId: string }) {
  const { pending, feedback, run } = useActionFeedback({
    describe: describeGeneratePath,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        generatePcmsoDocumentAction(companyId, {
          cycleStart: fd.get("cycleStart"),
        }),
      { slots: ["cycleStart"] },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <TextField
        label="Data-base do ciclo de planejamento (12 meses, MED-14)"
        name="cycleStart"
        type="date"
        required
        error={feedback.fields.cycleStart}
      />
      <SubmitButton pending={pending} label="Gerar prévia do PCMSO" />
    </form>
  );
}
