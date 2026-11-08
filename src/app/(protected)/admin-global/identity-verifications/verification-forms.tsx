"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

import {
  EMPTY_FORM_FEEDBACK,
  formFeedback,
  pathDescriber,
  unexpectedFormFeedback,
  type FormFeedback,
} from "@/shared/domains/medicine/form-feedback";
import {
  IDENTITY_METHOD_LABELS,
  IDENTITY_METHODS,
} from "@/shared/domains/medicine/professional-identity";
import {
  approveIdentityVerificationAction,
  rejectIdentityRequestAction,
  revokeIdentityVerificationAction,
} from "@/shared/server/actions/medicine/professional-identity";

import {
  FieldError,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

type Result =
  | { ok: true }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };

const CHECKS = [
  ["identityDocument", "Documento oficial de identidade conferido"],
  ["professionalDocument", "Documento ou registro profissional conferido"],
  ["registryStatus", "Situação do CRM/UF ativa na fonte oficial"],
  ["personMatches", "Pessoa apresentada, documentos e cadastro correspondem"],
  ["accountControl", "Código de controle da conta conferido ao vivo"],
] as const;

const describeVerificationPath = pathDescriber({
  fields: {
    requestId: "Pedido",
    method: "Método",
    crm: "CRM conferido",
    registrationUf: "UF conferida",
    registrySource: "Fonte oficial consultada",
    evidenceRef: "Referência de auditoria",
    challengeCode: "Código de controle da conta",
    checklist: "Checklist da conferência",
    ...Object.fromEntries(CHECKS.map(([key, label]) => [`checklist.${key}`, label])),
    reason: "Motivo",
  },
});

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback>(EMPTY_FORM_FEEDBACK);
  const run = (fn: () => Promise<Result>, slots: readonly string[]) =>
    startTransition(async () => {
      let result: Result;
      try {
        result = await fn();
      } catch {
        setFeedback(unexpectedFormFeedback());
        return;
      }
      if (result.ok) {
        setFeedback(EMPTY_FORM_FEEDBACK);
        router.refresh();
      } else {
        setFeedback(
          formFeedback(result.error, { slots, describe: describeVerificationPath }),
        );
      }
    });
  return { pending, feedback, run };
}

const APPROVE_SLOTS = [
  "method",
  "crm",
  "registrationUf",
  "registrySource",
  "evidenceRef",
  "challengeCode",
  "checklist",
  ...CHECKS.map(([key]) => `checklist.${key}`),
];

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
  const { pending, feedback, run } = useRun();
  const { fields } = feedback;
  const baseId = useId();
  const checklistErrorId = `${baseId}-checklist-error`;
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        approveIdentityVerificationAction({
          requestId,
          method: fd.get("method") || undefined,
          crm: fd.get("crm"),
          registrationUf: fd.get("registrationUf"),
          registrySource: fd.get("registrySource"),
          evidenceRef: (fd.get("evidenceRef") as string) || undefined,
          challengeCode: fd.get("challengeCode"),
          checklist: Object.fromEntries(
            CHECKS.map(([key]) => [key, fd.get(key) === "on"]),
          ),
        }),
      APPROVE_SLOTS,
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <FormError message={feedback.formError} details={feedback.details} />
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
      <fieldset
        className="flex flex-col gap-1"
        aria-describedby={fields.checklist ? checklistErrorId : undefined}
      >
        <legend className="text-text text-sm font-semibold">
          Checklist da conferência
        </legend>
        {CHECKS.map(([key, label]) => {
          const message = fields[`checklist.${key}`];
          const errorId = `${baseId}-${key}-error`;
          return (
            <div key={key}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name={key}
                  aria-invalid={message ? true : undefined}
                  aria-describedby={message ? errorId : undefined}
                />{" "}
                {label}
              </label>
              <FieldError id={errorId} message={message} />
            </div>
          );
        })}
        <FieldError id={checklistErrorId} message={fields.checklist} />
      </fieldset>
      <SubmitButton pending={pending} label="Registrar verificação" />
    </form>
  );
}

/** Recusa de pedido ou revogação de verificação, com motivo. */
export function DecisionForm({ id, kind }: { id: string; kind: "reject" | "revoke" }) {
  const { pending, feedback, run } = useRun();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = { reason: fd.get("reason") };
    run(
      () =>
        kind === "reject"
          ? rejectIdentityRequestAction(id, input)
          : revokeIdentityVerificationAction(id, input),
      ["reason"],
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <FormError message={feedback.formError} details={feedback.details} />
      <TextField label="Motivo" name="reason" required error={feedback.fields.reason} />
      <SubmitButton
        pending={pending}
        label={kind === "reject" ? "Recusar pedido" : "Revogar verificação"}
      />
    </form>
  );
}
