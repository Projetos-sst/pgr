"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { defineInterpretationCriteriaAction } from "@/shared/server/actions/medicine/interpretation-criteria";

import { FormError, SubmitButton, TextAreaField } from "../../../_ui/form";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await defineInterpretationCriteriaAction(companyId, {
        code: procedureCode,
        otherDescription: otherDescription ?? undefined,
        criteria: fd.get("criteria"),
        conduct: fd.get("conduct"),
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
      <TextAreaField
        label="Critérios de interpretação dos achados"
        name="criteria"
        defaultValue={current?.criteria}
        required
        error={fields.criteria}
      />
      <TextAreaField
        label="Planejamento das condutas"
        name="conduct"
        defaultValue={current?.conduct}
        required
        error={fields.conduct}
      />
      <SubmitButton
        pending={pending}
        label={current ? "Registrar nova versão" : "Registrar critérios"}
      />
    </form>
  );
}
