"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  addExamProcedureAction,
  confirmExamCompanyOriginAction,
  confirmExaminerConclusionAction,
  generateAsoDocumentAction,
  removeExamProcedureAction,
} from "@/shared/server/actions/medicine/aso";

import { FormError, SubmitButton, TextField } from "../../../_ui/form";

type Result =
  | { ok: true }
  | { ok: false; error: { message: string; fields?: Record<string, string> } };

function useSubmit() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<Result>, onOk?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setError(null);
        setFields({});
        onOk?.();
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.fields ? null : result.error.message);
      }
    });
  return { pending, error, fields, run };
}

/** Registra um exame complementar realizado: código da Tabela 27 e data. Sem resultado clínico. */
export function ProcedureForm({ examId }: { examId: string }) {
  const { pending, error, fields, run } = useSubmit();
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
      () => form.reset(),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <TextField
        label="Código do procedimento (Tabela 27 do eSocial)"
        name="code"
        required
        isMono
        placeholder="0281"
        error={fields.code}
      />
      <TextField
        label="Descrição (só para o código 9999)"
        name="otherDescription"
        error={fields.otherDescription}
      />
      <TextField
        label="Data de realização"
        name="performedAt"
        type="date"
        required
        error={fields.performedAt}
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
  const { pending, error, run } = useSubmit();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => removeExamProcedureAction(examId, procedureId));
      }}
      className="inline-flex items-center gap-2"
    >
      <FormError message={error} />
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
  const { pending, error, run } = useSubmit();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => generateAsoDocumentAction(examId));
      }}
      className="flex flex-col gap-2"
    >
      <FormError message={error} />
      <SubmitButton pending={pending} label="Gerar prévia do ASO" />
    </form>
  );
}

/** O responsável confirma, com justificativa, a empresa de origem de exame antigo (MED-07). */
export function CompanyOriginForm({ examId }: { examId: string }) {
  const { pending, error, fields, run } = useSubmit();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(() =>
      confirmExamCompanyOriginAction(examId, { justification: fd.get("justification") }),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <TextField
        label="Como foi comprovado que o exame foi feito na empresa atual do funcionário"
        name="justification"
        required
        error={fields.justification}
      />
      <SubmitButton pending={pending} label="Confirmar empresa de origem" />
    </form>
  );
}

/** O médico examinador, pela conta vinculada, confirma apto ou inapto para "apto com restrição". */
export function ExaminerConclusionForm({ examId }: { examId: string }) {
  const { pending, error, fields, run } = useSubmit();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(() =>
      confirmExaminerConclusionAction(examId, { conclusion: fd.get("conclusion") }),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error ?? fields.conclusion ?? null} />
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 font-semibold">Conclusão para o ASO</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="conclusion" value="fit" required /> Apto para a função
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="conclusion" value="unfit" /> Inapto para a função
        </label>
      </fieldset>
      <SubmitButton pending={pending} label="Confirmar como médico examinador" />
    </form>
  );
}
