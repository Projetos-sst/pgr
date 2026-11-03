"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { addAbsenceClinicalNoteAction } from "@/shared/server/actions/medicine/absences";

import { FormError, SubmitButton, TextAreaField, TextField } from "../../../_ui/form";

/** Novo registro clínico do afastamento (só inclusão), escrito pelo coordenador vinculado. */
export function AbsenceClinicalNoteForm({ absenceId }: { absenceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await addAbsenceClinicalNoteAction(absenceId, {
        content: (fd.get("content") as string) || undefined,
        cid: (fd.get("cid") as string) || undefined,
        workerAuthorization: (fd.get("workerAuthorization") as string) || undefined,
      });
      if (result.ok) {
        setError(null);
        setFields({});
        form.reset();
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
        label="Atestado / observação clínica"
        name="content"
        rows={3}
        error={fields.content}
      />
      <TextField label="CID-10 (opcional)" name="cid" isMono error={fields.cid} />
      <TextField
        label="Autorização do trabalhador para o CID (referência do termo)"
        name="workerAuthorization"
        error={fields.workerAuthorization}
      />
      <SubmitButton pending={pending} label="Registrar" />
    </form>
  );
}
