"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  IDENTITY_METHOD_LABELS,
  IDENTITY_METHODS,
} from "@/shared/domains/medicine/professional-identity";
import {
  approveIdentityVerificationAction,
  rejectIdentityRequestAction,
  revokeIdentityVerificationAction,
} from "@/shared/server/actions/medicine/professional-identity";

import { FormError, SelectField, SubmitButton, TextField } from "../../_ui/form";

type Result =
  | { ok: true }
  | { ok: false; error: { message: string; fields?: Record<string, string> } };

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setError(null);
        setFields({});
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.message);
      }
    });
  return { pending, error, fields, run };
}

const CHECKS = [
  ["identityDocument", "Documento oficial de identidade conferido"],
  ["professionalDocument", "Documento ou registro profissional conferido"],
  ["registryStatus", "Situação do CRM/UF ativa na fonte oficial"],
  ["personMatches", "Pessoa apresentada, documentos e cadastro correspondem"],
  ["accountControl", "Código de controle da conta conferido ao vivo"],
] as const;

/** Aprovação com checklist completo, CRM/UF conferidos e código mostrado pela própria conta. */
export function ApproveForm({
  requestId,
  crm,
  uf,
}: {
  requestId: string;
  crm: string;
  uf: string | null;
}) {
  const { pending, error, fields, run } = useRun();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(() =>
      approveIdentityVerificationAction({
        requestId,
        method: fd.get("method") || undefined,
        crm: fd.get("crm"),
        registrationUf: fd.get("registrationUf"),
        registrySource: fd.get("registrySource"),
        evidenceRef: (fd.get("evidenceRef") as string) || undefined,
        challengeCode: fd.get("challengeCode"),
        checklist: Object.fromEntries(CHECKS.map(([key]) => [key, fd.get(key) === "on"])),
      }),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <FormError message={error} />
      <SelectField
        label="Método"
        name="method"
        required
        options={IDENTITY_METHODS.map((m) => ({
          value: m,
          label: IDENTITY_METHOD_LABELS[m],
        }))}
        emptyLabel="— selecione —"
        error={fields.method}
      />
      <TextField
        label="CRM conferido"
        name="crm"
        required
        defaultValue={crm}
        error={fields.crm}
      />
      <TextField
        label="UF conferida"
        name="registrationUf"
        required
        defaultValue={uf ?? undefined}
        error={fields.registrationUf}
      />
      <TextField
        label="Fonte oficial consultada"
        name="registrySource"
        required
        placeholder="Ex.: consulta pública do CFM em AAAA-MM-DD"
        error={fields.registrySource}
      />
      <TextField
        label="Referência de auditoria (sem documento)"
        name="evidenceRef"
        error={fields.evidenceRef}
      />
      <TextField
        label="Código de controle da conta (informado ao vivo)"
        name="challengeCode"
        required
        isMono
        error={fields.challengeCode}
      />
      {CHECKS.map(([key, label]) => (
        <label key={key} className="flex items-center gap-2">
          <input type="checkbox" name={key} /> {label}
        </label>
      ))}
      <SubmitButton pending={pending} label="Registrar verificação" />
    </form>
  );
}

/** Recusa de pedido ou revogação de verificação, com motivo. */
export function DecisionForm({ id, kind }: { id: string; kind: "reject" | "revoke" }) {
  const { pending, error, fields, run } = useRun();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = { reason: fd.get("reason") };
    run(() =>
      kind === "reject"
        ? rejectIdentityRequestAction(id, input)
        : revokeIdentityVerificationAction(id, input),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <FormError message={error} />
      <TextField label="Motivo" name="reason" required error={fields.reason} />
      <SubmitButton
        pending={pending}
        label={kind === "reject" ? "Recusar pedido" : "Revogar verificação"}
      />
    </form>
  );
}
