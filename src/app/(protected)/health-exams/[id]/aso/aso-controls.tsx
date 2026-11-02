"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  addExamProcedureAction,
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
