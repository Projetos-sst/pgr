"use client";

import { useId, useState, type FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import {
  closePcmsoCoordinatorAction,
  designatePcmsoCoordinatorAction,
} from "@/shared/server/actions/medicine/pcmso-coordinators";

import {
  FieldError,
  FormError,
  SubmitButton,
  TextField,
  fieldClass,
} from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

type Option = { id: string; label: string; hasRqe: boolean; hasUf: boolean };

const describeCoordinatorPath = pathDescriber({
  fields: {
    companyId: "Empresa",
    medicoId: "Médico",
    startsOn: "Início",
    rqeExceptionReason: "Justificativa da exceção (NR-7, item 7.5.2)",
    endsOn: "Fim",
    endReason: "Motivo",
  },
});

export function DesignateCoordinatorForm({
  companyId,
  options,
}: {
  companyId: string;
  options: Option[];
}) {
  const { pending, feedback, run } = useActionFeedback({
    describe: describeCoordinatorPath,
  });
  const fields = feedback.fields;
  const medicoErrorId = useId();
  const reasonErrorId = useId();
  const [medicoId, setMedicoId] = useState("");
  const selected = options.find((o) => o.id === medicoId);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    run(
      () =>
        designatePcmsoCoordinatorAction(companyId, {
          medicoId: fd.get("medicoId"),
          startsOn: fd.get("startsOn"),
          rqeExceptionReason: fd.get("rqeExceptionReason") ?? "",
        }),
      {
        // A justificativa só está na tela para médico sem RQE.
        slots: [
          "medicoId",
          "startsOn",
          ...(selected && !selected.hasRqe ? ["rqeExceptionReason"] : []),
        ],
        onOk: () => {
          form.reset();
          setMedicoId("");
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError message={feedback.formError} details={feedback.details} />
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
          aria-invalid={fields.medicoId ? true : undefined}
          aria-describedby={fields.medicoId ? medicoErrorId : undefined}
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
        <FieldError id={medicoErrorId} message={fields.medicoId} />
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
            aria-invalid={fields.rqeExceptionReason ? true : undefined}
            aria-describedby={fields.rqeExceptionReason ? reasonErrorId : undefined}
          />
          <FieldError id={reasonErrorId} message={fields.rqeExceptionReason} />
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
  const { pending, feedback, run } = useActionFeedback({
    describe: describeCoordinatorPath,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        closePcmsoCoordinatorAction(companyId, assignmentId, {
          endsOn: fd.get("endsOn"),
          endReason: fd.get("endReason"),
        }),
      { slots: ["endsOn", "endReason"] },
    );
  }

  return (
    <details className="rounded-lg border border-white/50 p-4">
      <summary className="text-text cursor-pointer text-sm font-semibold">
        Encerrar sem substituto (início em {startsOn})
      </summary>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-4">
        <FormError message={feedback.formError} details={feedback.details} />
        <TextField
          label="Fim"
          name="endsOn"
          type="date"
          required
          error={feedback.fields.endsOn}
        />
        <TextField
          label="Motivo"
          name="endReason"
          required
          isFullWidth
          error={feedback.fields.endReason}
        />
        <SubmitButton pending={pending} label="Encerrar designação" />
      </form>
    </details>
  );
}
