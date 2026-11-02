"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  CLINICAL_NOTE_MAX,
  WORK_RESTRICTION_MAX,
} from "@/shared/domains/medicine/clinical-record";
import {
  addClinicalNoteAction,
  recordWorkRestrictionAction,
} from "@/shared/server/actions/medicine/clinical-record";

import { FormError, SubmitButton, TextAreaField } from "../../../_ui/form";

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

/** Nova observação clínica do prontuário, escrita pelo médico. Só inclusão: corrigir = novo registro. */
export function ClinicalNoteForm({ examId }: { examId: string }) {
  const { pending, error, fields, run } = useSubmit();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    run(
      () => addClinicalNoteAction(examId, { content: fd.get("content") ?? "" }),
      () => form.reset(),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <TextAreaField
        label="Nova observação clínica"
        name="content"
        rows={4}
        required
        error={fields.content}
      />
      <p className="text-text-subtle text-xs">
        Registros não são editados nem apagados; uma correção entra como nova observação.
        Máximo de {CLINICAL_NOTE_MAX.toLocaleString("pt-BR")} caracteres.
      </p>
      <SubmitButton pending={pending} label="Registrar observação" />
    </form>
  );
}

/**
 * Comunicação ao RH da restrição necessária ao trabalho (MED-17): só a restrição funcional, sem
 * diagnóstico nem CID. O servidor recusa texto com código CID.
 */
export function WorkRestrictionForm({
  examId,
  hasCurrent,
}: {
  examId: string;
  hasCurrent: boolean;
}) {
  const { pending, error, fields, run } = useSubmit();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    run(
      () =>
        recordWorkRestrictionAction(examId, {
          kind: "restriction",
          restriction: fd.get("restriction") ?? "",
        }),
      () => form.reset(),
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <FormError message={error} />
        <TextAreaField
          label="Restrição comunicada ao RH"
          name="restriction"
          rows={3}
          required
          placeholder="Ex.: não levantar cargas acima de 10 kg por 30 dias."
          error={fields.restriction}
        />
        <p className="text-text-subtle text-xs">
          O RH lê este texto. Descreva só a restrição ao trabalho, sem diagnóstico nem
          CID. Máximo de {WORK_RESTRICTION_MAX.toLocaleString("pt-BR")} caracteres.
        </p>
        <SubmitButton pending={pending} label="Comunicar restrição" />
      </form>
      {hasCurrent ? (
        <button
          type="button"
          disabled={pending}
          className="text-primary self-start text-sm font-semibold underline disabled:opacity-60"
          onClick={() =>
            run(() => recordWorkRestrictionAction(examId, { kind: "withdrawal" }))
          }
        >
          Registrar que as restrições deixaram de valer
        </button>
      ) : null}
    </div>
  );
}
