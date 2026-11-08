"use client";

import type { FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import { generateAnalyticalReportAction } from "@/shared/server/actions/medicine/analytical-reports";

import { FormError, SubmitButton, TextAreaField, TextField } from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

const describeReportFormPath = pathDescriber({
  fields: {
    periodStart: "Início do período",
    periodEnd: "Fim do período",
    simplified: "Relatório simplificado",
    variationDiscussion: "Discussão sobre as variações",
    insufficiencyNote: "Informações insuficientes",
  },
});

/**
 * Elaboração do relatório pelo médico coordenador. Os números vêm do sistema; a discussão das
 * variações e a nota de insuficiência são texto do médico, sem preenchimento automático.
 */
export function ReportForm({
  companyId,
  suggested,
  hasPrevious,
  canSimplify,
}: {
  companyId: string;
  suggested: { periodStart: string; periodEnd: string } | null;
  hasPrevious: boolean;
  canSimplify: boolean;
}) {
  const { pending, feedback, run } = useActionFeedback({
    describe: describeReportFormPath,
  });
  const fields = feedback.fields;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        generateAnalyticalReportAction(companyId, {
          periodStart: fd.get("periodStart"),
          periodEnd: fd.get("periodEnd"),
          simplified: fd.get("simplified") === "on",
          variationDiscussion: (fd.get("variationDiscussion") as string) || undefined,
          insufficiencyNote: (fd.get("insufficiencyNote") as string) || undefined,
        }),
      {
        // Só os campos visíveis recebem o erro no próprio campo; os demais vão ao resumo.
        slots: [
          "periodStart",
          "periodEnd",
          "insufficiencyNote",
          ...(hasPrevious ? ["variationDiscussion"] : []),
        ],
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <TextField
        label="Início do período"
        name="periodStart"
        type="date"
        defaultValue={suggested?.periodStart}
        required
        error={fields.periodStart}
      />
      <TextField
        label="Fim do período"
        name="periodEnd"
        type="date"
        defaultValue={suggested?.periodEnd}
        required
        error={fields.periodEnd}
      />
      {canSimplify ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="simplified" /> Relatório simplificado, só alíneas a
          e b (NR-7 7.6.6)
        </label>
      ) : null}
      {hasPrevious ? (
        <TextAreaField
          label="Discussão sobre as variações em relação ao relatório anterior (NR-7 7.6.2 f)"
          name="variationDiscussion"
          error={fields.variationDiscussion}
        />
      ) : null}
      <TextAreaField
        label="Informações insuficientes ou prontuários não recebidos (NR-7 7.6.4), se houver"
        name="insufficiencyNote"
        error={fields.insufficiencyNote}
      />
      <SubmitButton pending={pending} label="Elaborar prévia do relatório" />
    </form>
  );
}
