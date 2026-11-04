"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  ASO_DELIVERY_EVIDENCE_KINDS,
  ASO_DELIVERY_EVIDENCE_LABELS,
  ASO_DELIVERY_METHOD_LABELS,
  ASO_DELIVERY_METHODS,
  ASO_EVIDENCE_REVIEW_METHOD_LABELS,
  ASO_EVIDENCE_REVIEW_METHODS,
  ASO_EVIDENCE_REVIEW_RESULT_LABELS,
  ASO_EVIDENCE_REVIEW_RESULTS,
} from "@/shared/domains/medicine/aso-delivery";
import {
  getAsoDeliveryEvidenceAction,
  registerAsoDeliveryAction,
  reviewAsoDeliveryEvidenceAction,
  voidAsoDeliveryAction,
} from "@/shared/server/actions/medicine/aso";

import {
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_ui/form";

type Kind = "made_available" | "physical_copy_requested" | "";

/**
 * Registro da entrega do ASO assinado vigente ao trabalhador, ou do pedido de via física (NOB-165).
 * Sem comprovante, a entrega fica só "registrada"; o recibo assinado pelo trabalhador é o que
 * confirma a ciência. Nada aqui marca recebimento por um clique.
 */
export function AsoDeliveryForm({ examId }: { examId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<Kind>("");
  const [method, setMethod] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await registerAsoDeliveryAction(examId, data);
      if (result.ok) {
        setError(null);
        setFields({});
        form.reset();
        setKind("");
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
      <SelectField
        label="O que registrar"
        name="kind"
        required
        value={kind}
        onChange={(v) => setKind(v as Kind)}
        options={[
          { value: "made_available", label: "Entrega do ASO ao trabalhador" },
          {
            value: "physical_copy_requested",
            label: "Pedido de via física pelo trabalhador",
          },
        ]}
        error={fields.kind}
      />
      {kind === "made_available" ? (
        <SelectField
          label="Método"
          name="method"
          required
          value={method}
          onChange={setMethod}
          options={ASO_DELIVERY_METHODS.map((value) => ({
            value,
            label: ASO_DELIVERY_METHOD_LABELS[value],
          }))}
          error={fields.method}
        />
      ) : null}
      {method === "digital_copy" && kind === "made_available" ? (
        <TextField
          label="Canal usado (ex.: e-mail pessoal informado pelo trabalhador)"
          name="channelDescription"
          required
          error={fields.channelDescription}
        />
      ) : null}
      <TextField
        label="Data e hora (horário de Brasília)"
        name="occurredAt"
        type="datetime-local"
        required
        error={fields.occurredAt}
      />
      <TextField
        label={
          kind === "physical_copy_requested"
            ? "Como o pedido foi feito (opcional)"
            : "Evidência da entrega (quem entregou, onde está o recibo)"
        }
        name="evidenceReference"
        required={kind === "made_available"}
        error={fields.evidenceReference}
      />
      {kind === "made_available" ? (
        <>
          <SelectField
            label="Tipo do comprovante anexado (se houver)"
            name="evidenceKind"
            emptyLabel="Sem comprovante anexado"
            options={ASO_DELIVERY_EVIDENCE_KINDS.map((value) => ({
              value,
              label: ASO_DELIVERY_EVIDENCE_LABELS[value],
            }))}
            error={fields.evidenceKind}
          />
          <label className="text-text block text-sm font-semibold">
            Comprovante (PDF, JPEG ou PNG, até 10 MB)
            <input
              type="file"
              name="evidence"
              accept="application/pdf,image/jpeg,image/png"
              className="mt-1 block text-sm"
            />
          </label>
        </>
      ) : null}
      <SubmitButton pending={pending} label="Registrar" />
    </form>
  );
}

/** Corrige um registro anterior, com motivo; o original continua no histórico. */
export function VoidAsoDeliveryForm({
  examId,
  deliveryId,
}: {
  examId: string;
  deliveryId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <button
        type="button"
        className="text-xs font-semibold text-amber-900 underline"
        onClick={() => setOpen(true)}
      >
        Corrigir registro
      </button>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const reason = new FormData(event.currentTarget).get("reason");
        startTransition(async () => {
          const result = await voidAsoDeliveryAction(examId, deliveryId, { reason });
          if (result.ok) {
            setOpen(false);
            router.refresh();
          } else setError(result.error.fields?.reason ?? result.error.message);
        });
      }}
    >
      <TextAreaField
        label="Motivo da correção"
        name="reason"
        required
        rows={2}
        error={error ?? undefined}
      />
      <SubmitButton pending={pending} label="Registrar correção" />
    </form>
  );
}

/** Abre o comprovante por URL assinada curta. */
export function AsoDeliveryEvidenceButton({ id }: { id: string }) {
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
            const result = await getAsoDeliveryEvidenceAction(id);
            if (result.ok) {
              setError(null);
              window.open(result.data.url, "_blank", "noopener,noreferrer");
            } else setError(result.error.message);
          })
        }
      >
        {pending ? "Abrindo…" : "Ver comprovante"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Conferência humana do comprovante (NOB-167): ato separado do upload. Quem confere abre o
 * comprovante, confere trabalhador e ASO, e registra método, resultado e o que foi conferido. O
 * revisor é o usuário da sessão; "assinatura presenciada" só vale para recibo do trabalhador.
 */
export function ReviewAsoEvidenceForm({
  examId,
  deliveryId,
  signedReceipt,
}: {
  examId: string;
  deliveryId: string;
  signedReceipt: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  if (!open)
    return (
      <button
        type="button"
        className="text-primary text-xs font-semibold underline"
        onClick={() => setOpen(true)}
      >
        Conferir comprovante
      </button>
    );
  const methods = ASO_EVIDENCE_REVIEW_METHODS.filter(
    (m) => signedReceipt || m !== "signature_witnessed",
  );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await reviewAsoDeliveryEvidenceAction(examId, deliveryId, {
            method: fd.get("method"),
            result: fd.get("result"),
            reference: fd.get("reference"),
          });
          if (result.ok) {
            setOpen(false);
            router.refresh();
          } else {
            setFields(result.error.fields ?? {});
            setError(result.error.fields ? null : result.error.message);
          }
        });
      }}
    >
      <FormError message={error} />
      <SelectField
        label="Como foi conferido"
        name="method"
        required
        options={methods.map((value) => ({
          value,
          label: ASO_EVIDENCE_REVIEW_METHOD_LABELS[value],
        }))}
        error={fields.method}
      />
      <SelectField
        label="Resultado"
        name="result"
        required
        options={ASO_EVIDENCE_REVIEW_RESULTS.map((value) => ({
          value,
          label: ASO_EVIDENCE_REVIEW_RESULT_LABELS[value],
        }))}
        error={fields.result}
      />
      <TextField
        label="O que foi conferido (referência de auditoria)"
        name="reference"
        required
        error={fields.reference}
      />
      <SubmitButton pending={pending} label="Registrar conferência" />
    </form>
  );
}
