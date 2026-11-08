"use client";

import { useState, type FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import {
  PCMSO_CHANGE_KIND_LABELS,
  PCMSO_CHANGE_KINDS,
  PCMSO_SIGNATURE_METHOD_LABELS,
  PCMSO_SIGNATURE_METHODS,
  PCMSO_SIGNED_ORIGIN_LABELS,
  PCMSO_SIGNED_ORIGINS,
  PCMSO_VERIFICATION_HINTS,
  type PcmsoSignatureMethodValue,
} from "@/shared/domains/medicine/pcmso-signed";
import {
  getSignedPcmsoDownloadAction,
  registerSignedPcmsoAction,
} from "@/shared/server/actions/medicine/pcmso-documents";

import {
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

const describeSignedPcmsoPath = pathDescriber({
  fields: {
    origin: "Quem registra",
    previewDocumentId: "Prévia assinada",
    signatureMethod: "Método de assinatura",
    verificationReference: "Conferência documental da assinatura",
    signerName: "Médico que assinou",
    signerRegistration: "CRM do signatário",
    signerUf: "UF do CRM",
    signedOn: "Data da assinatura",
    replacesId: "Documento vigente substituído",
    changeKind: "Tipo de mudança da nova versão",
    replaceReason: "Motivo da substituição",
  },
});

const SIGNED_PCMSO_SLOTS = [
  "origin",
  "signatureMethod",
  "verificationReference",
  "signerName",
  "signerRegistration",
  "signerUf",
  "signedOn",
] as const;

/**
 * Registro do PCMSO assinado (NOB-166): PDF da prévia mais recente assinado pelo médico responsável
 * designado. O sistema não assina e não valida a assinatura criptograficamente: guarda o arquivo
 * íntegro e a conferência documental. Com documento vigente, o novo registro é uma substituição.
 */
export function SignedPcmsoForm({
  companyId,
  latestPreview,
  coordinator,
  currentId,
}: {
  companyId: string;
  latestPreview: { id: string; version: number } | null;
  coordinator: { name: string; crm: string; uf: string | null } | null;
  currentId: string | null;
}) {
  const { pending, feedback, run } = useActionFeedback({
    describe: describeSignedPcmsoPath,
  });
  const fields = feedback.fields;
  const [method, setMethod] = useState<PcmsoSignatureMethodValue | "">("");

  if (!latestPreview)
    return (
      <p className="text-amber-900">
        Gere a prévia do PCMSO antes: só uma prévia do sistema, assinada, vira o documento
        oficial.
      </p>
    );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("previewDocumentId", latestPreview!.id);
    if (currentId) data.set("replacesId", currentId);
    run(() => registerSignedPcmsoAction(companyId, data), {
      // Tipo de mudança e motivo só estão na tela quando há documento vigente.
      slots: currentId
        ? [...SIGNED_PCMSO_SLOTS, "changeKind", "replaceReason"]
        : SIGNED_PCMSO_SLOTS,
      // Limpa só depois do sucesso confirmado; erro mantém o que foi digitado.
      onOk: () => {
        form.reset();
        setMethod("");
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <p className="text-text-subtle">
        Prévia assinada: versão {latestPreview.version}.{" "}
        {coordinator
          ? `Signatário esperado: ${coordinator.name} · CRM ${coordinator.crm}/${coordinator.uf ?? "—"}.`
          : "Sem médico responsável designado."}
      </p>
      <SelectField
        label="Quem registra"
        name="origin"
        required
        options={PCMSO_SIGNED_ORIGINS.map((value) => ({
          value,
          label: PCMSO_SIGNED_ORIGIN_LABELS[value],
        }))}
        error={fields.origin}
      />
      <SelectField
        label="Método de assinatura"
        name="signatureMethod"
        required
        value={method}
        onChange={(v) => setMethod(v as PcmsoSignatureMethodValue | "")}
        options={PCMSO_SIGNATURE_METHODS.map((value) => ({
          value,
          label: PCMSO_SIGNATURE_METHOD_LABELS[value],
        }))}
        error={fields.signatureMethod}
      />
      <TextField
        label="Conferência documental da assinatura"
        name="verificationReference"
        required
        placeholder={method ? PCMSO_VERIFICATION_HINTS[method] : "Escolha o método"}
        error={fields.verificationReference}
      />
      <TextField
        label="Médico que assinou (como consta no documento)"
        name="signerName"
        required
        defaultValue={coordinator?.name}
        error={fields.signerName}
      />
      <TextField
        label="CRM do signatário"
        name="signerRegistration"
        required
        isMono
        defaultValue={coordinator?.crm}
        error={fields.signerRegistration}
      />
      <TextField
        label="UF do CRM"
        name="signerUf"
        required
        defaultValue={coordinator?.uf}
        error={fields.signerUf}
      />
      <TextField
        label="Data da assinatura"
        name="signedOn"
        type="date"
        required
        error={fields.signedOn}
      />
      {currentId ? (
        <>
          <SelectField
            label="Tipo de mudança da nova versão"
            name="changeKind"
            required
            options={PCMSO_CHANGE_KINDS.map((value) => ({
              value,
              label: PCMSO_CHANGE_KIND_LABELS[value],
            }))}
            error={fields.changeKind}
          />
          <TextAreaField
            label="Motivo da substituição do documento vigente"
            name="replaceReason"
            required
            rows={2}
            error={fields.replaceReason}
          />
        </>
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
        label={currentId ? "Registrar nova versão assinada" : "Registrar PCMSO assinado"}
      />
    </form>
  );
}

/** Abre o PDF assinado por URL assinada curta. */
export function DownloadSignedPcmsoButton({ id }: { id: string }) {
  const { pending, feedback, run } = useActionFeedback();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="text-primary text-xs font-semibold underline disabled:opacity-60"
        onClick={() =>
          run(() => getSignedPcmsoDownloadAction(id), {
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
