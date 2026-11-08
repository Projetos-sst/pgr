"use client";

import { useState, type FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import {
  ASO_SIGNATURE_METHOD_LABELS,
  ASO_SIGNATURE_METHODS,
  ASO_SIGNED_CONCLUSION_LABELS,
  ASO_SIGNED_ORIGIN_LABELS,
  ASO_SIGNED_ORIGINS,
  ASO_VERIFICATION_HINTS,
  type AsoSignatureMethodValue,
  type AsoSignedOriginValue,
} from "@/shared/domains/medicine/aso-signed";
import {
  getSignedAsoDownloadAction,
  registerSignedAsoAction,
} from "@/shared/server/actions/medicine/aso";

import {
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

export type PreviewOption = { id: string; version: number };

const describeSignedAsoPath = pathDescriber({
  fields: {
    origin: "Origem do documento assinado",
    previewDocumentId: "Prévia do sistema que foi assinada",
    signatureMethod: "Método de assinatura",
    verificationReference: "Conferência da assinatura",
    signerName: "Médico que assinou",
    signerRegistration: "CRM do signatário",
    signerUf: "UF do CRM",
    conclusion: "Conclusão no documento",
    signedOn: "Data da assinatura",
    replacesId: "Documento vigente substituído",
    replaceReason: "Motivo da substituição",
  },
});

/**
 * Registro do ASO assinado (NOB-163). O sistema não assina: guarda o PDF assinado, o método e a
 * conferência feita. Fluxo A (examinador, a partir da prévia) ou fluxo B (clínica externa). Com
 * documento vigente, o novo registro é uma substituição, com motivo.
 */
export function SignedAsoForm({
  examId,
  previews,
  currentId,
}: {
  examId: string;
  previews: PreviewOption[];
  currentId: string | null;
}) {
  const { pending, feedback, run } = useActionFeedback({
    describe: describeSignedAsoPath,
  });
  const fields = feedback.fields;
  const [origin, setOrigin] = useState<AsoSignedOriginValue | "">("");
  const [method, setMethod] = useState<AsoSignatureMethodValue | "">("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (currentId) data.set("replacesId", currentId);
    // Só os campos visíveis recebem o erro no próprio campo; os demais vão ao resumo.
    const slots = [
      "origin",
      "signatureMethod",
      "verificationReference",
      "signerName",
      "signerRegistration",
      "signerUf",
      "conclusion",
      "signedOn",
      ...(origin === "examiner" ? ["previewDocumentId"] : []),
      ...(currentId ? ["replaceReason"] : []),
    ];
    run(() => registerSignedAsoAction(examId, data), {
      slots,
      onOk: () => {
        form.reset();
        setOrigin("");
        setMethod("");
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <SelectField
        label="Origem do documento assinado"
        name="origin"
        required
        value={origin}
        onChange={(v) => setOrigin(v as AsoSignedOriginValue | "")}
        options={ASO_SIGNED_ORIGINS.map((value) => ({
          value,
          label: ASO_SIGNED_ORIGIN_LABELS[value],
        }))}
        error={fields.origin}
      />
      {origin === "examiner" ? (
        <SelectField
          label="Prévia do sistema que foi assinada"
          name="previewDocumentId"
          required
          options={previews.map((p) => ({
            value: p.id,
            label: `Prévia versão ${p.version}`,
          }))}
          emptyLabel={previews.length ? undefined : "Gere uma prévia antes"}
          error={fields.previewDocumentId}
        />
      ) : null}
      <SelectField
        label="Método de assinatura"
        name="signatureMethod"
        required
        value={method}
        onChange={(v) => setMethod(v as AsoSignatureMethodValue | "")}
        options={ASO_SIGNATURE_METHODS.map((value) => ({
          value,
          label: ASO_SIGNATURE_METHOD_LABELS[value],
        }))}
        error={fields.signatureMethod}
      />
      <TextField
        label="Conferência da assinatura"
        name="verificationReference"
        required
        placeholder={method ? ASO_VERIFICATION_HINTS[method] : "Escolha o método"}
        error={fields.verificationReference}
      />
      <TextField
        label="Médico que assinou (como consta no documento)"
        name="signerName"
        required
        error={fields.signerName}
      />
      <TextField
        label="CRM do signatário"
        name="signerRegistration"
        required
        isMono
        error={fields.signerRegistration}
      />
      <TextField
        label="UF do CRM"
        name="signerUf"
        required
        placeholder="MA"
        error={fields.signerUf}
      />
      <SelectField
        label="Conclusão no documento"
        name="conclusion"
        required
        options={(["fit", "unfit"] as const).map((value) => ({
          value,
          label: ASO_SIGNED_CONCLUSION_LABELS[value],
        }))}
        error={fields.conclusion}
      />
      <TextField
        label="Data da assinatura"
        name="signedOn"
        type="date"
        required
        error={fields.signedOn}
      />
      {currentId ? (
        <TextAreaField
          label="Motivo da substituição do documento vigente"
          name="replaceReason"
          required
          rows={2}
          error={fields.replaceReason}
        />
      ) : null}
      <label className="text-text block text-sm font-semibold">
        PDF assinado (até 25 MB)
        <input
          type="file"
          name="file"
          accept="application/pdf"
          required
          className="mt-1 block text-sm"
        />
      </label>
      <SubmitButton
        pending={pending}
        label={currentId ? "Registrar substituição" : "Registrar ASO assinado"}
      />
    </form>
  );
}

/** Abre o PDF por URL assinada curta. */
export function DownloadSignedAsoButton({ id }: { id: string }) {
  const { pending, feedback, run } = useActionFeedback();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="text-primary text-xs font-semibold underline disabled:opacity-60"
        onClick={() =>
          run(() => getSignedAsoDownloadAction(id), {
            refresh: false,
            onOk: (result) =>
              window.open(result.data.url, "_blank", "noopener,noreferrer"),
          })
        }
      >
        {pending ? "Abrindo…" : "Baixar PDF"}
      </button>
      {feedback.formError ? (
        <span role="alert" className="text-xs text-red-700">
          {feedback.formError}
        </span>
      ) : null}
    </span>
  );
}
