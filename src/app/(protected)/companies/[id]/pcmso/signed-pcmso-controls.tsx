"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
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
    startTransition(async () => {
      const result = await registerSignedPcmsoAction(companyId, data);
      if (result.ok) {
        setError(null);
        setFields({});
        form.reset();
        setMethod("");
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="text-primary text-xs font-semibold underline disabled:opacity-60"
        onClick={() =>
          startTransition(async () => {
            const result = await getSignedPcmsoDownloadAction(id);
            if (result.ok) {
              setError(null);
              window.open(result.data.url, "_blank", "noopener,noreferrer");
            } else setError(result.error.message);
          })
        }
      >
        {pending ? "Abrindo…" : "Baixar PDF"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
