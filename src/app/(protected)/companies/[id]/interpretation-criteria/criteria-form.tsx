"use client";

import type { FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import { defineInterpretationCriteriaAction } from "@/shared/server/actions/medicine/interpretation-criteria";

import { FormError, SubmitButton, TextAreaField } from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

// O exame (código e descrição) vem da página, sem campo próprio: o erro vai ao resumo.
const describeCriteriaPath = pathDescriber({
  fields: {
    code: "Exame (código do procedimento)",
    otherDescription: "Descrição do procedimento",
    criteria: "Critérios de interpretação",
    conduct: "Planejamento das condutas",
  },
});

/**
 * Nova versão do critério de um exame. O texto é do médico coordenador: o formulário só parte da
 * versão vigente do próprio médico, nunca de texto gerado pelo sistema (DT-23).
 */
export function CriteriaForm({
  companyId,
  procedureCode,
  otherDescription,
  current,
}: {
  companyId: string;
  procedureCode: string;
  otherDescription: string | null;
  current: { criteria: string; conduct: string } | null;
}) {
  const { pending, feedback, run } = useActionFeedback({
    describe: describeCriteriaPath,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        defineInterpretationCriteriaAction(companyId, {
          code: procedureCode,
          otherDescription: otherDescription ?? undefined,
          criteria: fd.get("criteria"),
          conduct: fd.get("conduct"),
        }),
      { slots: ["criteria", "conduct"] },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <TextAreaField
        label="Critérios de interpretação dos achados"
        name="criteria"
        defaultValue={current?.criteria}
        required
        error={feedback.fields.criteria}
      />
      <TextAreaField
        label="Planejamento das condutas"
        name="conduct"
        defaultValue={current?.conduct}
        required
        error={feedback.fields.conduct}
      />
      <SubmitButton
        pending={pending}
        label={current ? "Registrar nova versão" : "Registrar critérios"}
      />
    </form>
  );
}
