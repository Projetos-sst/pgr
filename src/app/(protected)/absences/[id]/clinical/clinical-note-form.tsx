"use client";

import type { FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import { addAbsenceClinicalNoteAction } from "@/shared/server/actions/medicine/absences";

import { FormError, SubmitButton, TextAreaField, TextField } from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

// Só rótulos: o conteúdo clínico e o CID digitados nunca entram no resumo de erro.
const describeClinicalNotePath = pathDescriber({
  fields: {
    content: "Atestado / observação clínica",
    cid: "CID-10",
    workerAuthorization: "Autorização do trabalhador para o CID",
  },
});

/** Novo registro clínico do afastamento (só inclusão), escrito pelo coordenador vinculado. */
export function AbsenceClinicalNoteForm({ absenceId }: { absenceId: string }) {
  const { pending, feedback, run } = useActionFeedback({
    describe: describeClinicalNotePath,
  });
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    run(
      () =>
        addAbsenceClinicalNoteAction(absenceId, {
          content: (fd.get("content") as string) || undefined,
          cid: (fd.get("cid") as string) || undefined,
          workerAuthorization: (fd.get("workerAuthorization") as string) || undefined,
        }),
      {
        slots: ["content", "cid", "workerAuthorization"],
        // Limpa só depois do sucesso: erro mantém o que foi digitado.
        onOk: () => form.reset(),
      },
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <TextAreaField
        label="Atestado / observação clínica"
        name="content"
        rows={3}
        error={feedback.fields.content}
      />
      <TextField label="CID-10 (opcional)" name="cid" isMono error={feedback.fields.cid} />
      <TextField
        label="Autorização do trabalhador para o CID (referência do termo)"
        name="workerAuthorization"
        error={feedback.fields.workerAuthorization}
      />
      <SubmitButton pending={pending} label="Registrar" />
    </form>
  );
}
