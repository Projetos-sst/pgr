"use client";

import { useId, type FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import {
  addExamProcedureAction,
  confirmExamCompanyOriginAction,
  confirmExaminerConclusionAction,
  generateAsoDocumentAction,
  removeExamProcedureAction,
} from "@/shared/server/actions/medicine/aso";

import { FieldError, FormError, SubmitButton, TextField } from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

const describeAsoPath = pathDescriber({
  fields: {
    code: "Código do procedimento",
    otherDescription: "Descrição do procedimento",
    performedAt: "Data de realização",
    justification: "Comprovação da empresa de origem",
    conclusion: "Conclusão para o ASO",
  },
});

const useSubmit = () => useActionFeedback({ describe: describeAsoPath });

/** Registra um exame complementar realizado: código da Tabela 27 e data. Sem resultado clínico. */
export function ProcedureForm({ examId }: { examId: string }) {
  const { pending, feedback, run } = useSubmit();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    run(
      () =>
        addExamProcedureAction(examId, {
          code: fd.get("code"),
          otherDescription: (fd.get("otherDescription") as string) || undefined,
          performedAt: fd.get("performedAt"),
        }),
      { slots: ["code", "otherDescription", "performedAt"], onOk: () => form.reset() },
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <TextField
        label="Código do procedimento (Tabela 27 do eSocial)"
        name="code"
        required
        isMono
        placeholder="0281"
        error={feedback.fields.code}
      />
      <TextField
        label="Descrição (só para o código 9999)"
        name="otherDescription"
        error={feedback.fields.otherDescription}
      />
      <TextField
        label="Data de realização"
        name="performedAt"
        type="date"
        required
        error={feedback.fields.performedAt}
      />
      <SubmitButton pending={pending} label="Registrar exame realizado" />
    </form>
  );
}

export function RemoveProcedureButton({
  examId,
  procedureId,
}: {
  examId: string;
  procedureId: string;
}) {
  const { pending, feedback, run } = useSubmit();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => removeExamProcedureAction(examId, procedureId));
      }}
      className="inline-flex items-center gap-2"
    >
      <FormError message={feedback.formError} details={feedback.details} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-700 underline disabled:opacity-50"
      >
        Remover
      </button>
    </form>
  );
}

export function GenerateAsoButton({ examId }: { examId: string }) {
  const { pending, feedback, run } = useSubmit();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => generateAsoDocumentAction(examId));
      }}
      className="flex flex-col gap-2"
    >
      <FormError message={feedback.formError} details={feedback.details} />
      <SubmitButton pending={pending} label="Gerar prévia do ASO" />
    </form>
  );
}

/** O responsável confirma, com justificativa, a empresa de origem de exame antigo (MED-07). */
export function CompanyOriginForm({ examId }: { examId: string }) {
  const { pending, feedback, run } = useSubmit();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        confirmExamCompanyOriginAction(examId, {
          justification: fd.get("justification"),
        }),
      { slots: ["justification"] },
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <TextField
        label="Como foi comprovado que o exame foi feito na empresa atual do funcionário"
        name="justification"
        required
        error={feedback.fields.justification}
      />
      <SubmitButton pending={pending} label="Confirmar empresa de origem" />
    </form>
  );
}

/** O médico examinador, pela conta vinculada, confirma apto ou inapto para "apto com restrição". */
export function ExaminerConclusionForm({ examId }: { examId: string }) {
  const { pending, feedback, run } = useSubmit();
  const errorId = useId();
  const conclusionError = feedback.fields.conclusion;
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () => confirmExaminerConclusionAction(examId, { conclusion: fd.get("conclusion") }),
      { slots: ["conclusion"] },
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <fieldset
        className="flex gap-4 text-sm"
        aria-invalid={conclusionError ? true : undefined}
        aria-describedby={conclusionError ? errorId : undefined}
      >
        <legend className="mb-1 font-semibold">Conclusão para o ASO</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="conclusion" value="fit" required /> Apto para a função
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="conclusion" value="unfit" /> Inapto para a função
        </label>
      </fieldset>
      <FieldError id={errorId} message={conclusionError} />
      <SubmitButton pending={pending} label="Confirmar como médico examinador" />
    </form>
  );
}
