"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  closePcmsoCoordinatorAction,
  designatePcmsoCoordinatorAction,
} from "@/shared/server/actions/medicine/pcmso-coordinators";

import { FormError, SubmitButton, TextField, fieldClass } from "../../../_ui/form";

type Option = { id: string; label: string; hasRqe: boolean; hasUf: boolean };

export function DesignateCoordinatorForm({
  companyId,
  options,
}: {
  companyId: string;
  options: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [medicoId, setMedicoId] = useState("");
  const selected = options.find((o) => o.id === medicoId);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await designatePcmsoCoordinatorAction(companyId, {
        medicoId: fd.get("medicoId"),
        startsOn: fd.get("startsOn"),
        rqeExceptionReason: fd.get("rqeExceptionReason") ?? "",
      });
      if (result.ok) {
        setError(null);
        setFields({});
        form.reset();
        setMedicoId("");
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.fields ? null : result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError message={error} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text font-semibold">
          Médico <span className="text-danger">*</span>
        </span>
        <select
          name="medicoId"
          required
          value={medicoId}
          onChange={(event) => setMedicoId(event.target.value)}
          className={fieldClass}
          aria-invalid={Boolean(fields.medicoId)}
        >
          <option value="">
            {options.length ? "Selecione" : "Nenhum médico ativo cadastrado"}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {fields.medicoId ? <span className="text-danger">{fields.medicoId}</span> : null}
      </label>
      <TextField
        label="Início"
        name="startsOn"
        type="date"
        required
        error={fields.startsOn}
      />
      {selected && !selected.hasUf ? (
        <p role="alert" className="text-danger text-sm">
          Este médico está sem a UF do CRM. Complete o cadastro antes de designá-lo.
        </p>
      ) : null}
      {selected && !selected.hasRqe ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text font-semibold">
            Justificativa da exceção (NR-7, item 7.5.2){" "}
            <span className="text-danger">*</span>
          </span>
          <span className="text-text-subtle">
            O médico não tem RQE em Medicina do Trabalho. A norma permite outro médico
            como responsável apenas quando não houver médico do trabalho na localidade.
          </span>
          <textarea
            name="rqeExceptionReason"
            rows={3}
            maxLength={1000}
            className={fieldClass}
            aria-invalid={Boolean(fields.rqeExceptionReason)}
          />
          {fields.rqeExceptionReason ? (
            <span className="text-danger">{fields.rqeExceptionReason}</span>
          ) : null}
        </label>
      ) : null}
      <SubmitButton pending={pending} label="Registrar designação" />
    </form>
  );
}

export function CloseCoordinatorForm({
  companyId,
  assignmentId,
  startsOn,
}: {
  companyId: string;
  assignmentId: string;
  startsOn: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await closePcmsoCoordinatorAction(companyId, assignmentId, {
        endsOn: fd.get("endsOn"),
        endReason: fd.get("endReason"),
      });
      if (result.ok) {
        setError(null);
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.fields ? null : result.error.message);
      }
    });
  }

  return (
    <details className="rounded-lg border border-white/50 p-4">
      <summary className="text-text cursor-pointer text-sm font-semibold">
        Encerrar sem substituto (início em {startsOn})
      </summary>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-4">
        <FormError message={error} />
        <TextField label="Fim" name="endsOn" type="date" required error={fields.endsOn} />
        <TextField
          label="Motivo"
          name="endReason"
          required
          isFullWidth
          error={fields.endReason}
        />
        <SubmitButton pending={pending} label="Encerrar designação" />
      </form>
    </details>
  );
}
