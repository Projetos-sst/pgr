"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  CIPA_SITUATION_LABELS,
  CIPA_SITUATIONS,
  REPORT_MODALITIES,
  REPORT_MODALITY_LABELS,
  REPORT_PARTICIPANT_ROLE_LABELS,
  REPORT_PARTICIPANT_ROLES,
  type ReportParticipantRole,
} from "@/shared/domains/medicine/analytical-report-presentation";
import {
  registerReportEventAction,
  voidReportEventAction,
} from "@/shared/server/actions/medicine/analytical-reports";

import {
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_ui/form";

type Result =
  | { ok: true }
  | { ok: false; error: { message: string; fields?: Record<string, string> } };

function useSubmit() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<Result>, onOk?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setError(null);
        setFields({});
        onOk?.();
        router.refresh();
      } else {
        setFields(result.error.fields ?? {});
        setError(result.error.message);
      }
    });
  return { pending, error, fields, run };
}

type Participant = { role: ReportParticipantRole | ""; name: string };

/** Funções representadas (e, se quiser, nomes). Nenhum dado clínico ou documento pessoal. */
function ParticipantsField({
  value,
  onChange,
}: {
  value: Participant[];
  onChange: (next: Participant[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-text text-sm font-semibold">
        Participantes (função e, opcionalmente, nome)
      </legend>
      {value.map((p, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <SelectField
            label="Função"
            name={`role-${i}`}
            value={p.role}
            onChange={(role) =>
              onChange(
                value.map((x, j) =>
                  j === i ? { ...x, role: role as Participant["role"] } : x,
                ),
              )
            }
            options={REPORT_PARTICIPANT_ROLES.map((role) => ({
              value: role,
              label: REPORT_PARTICIPANT_ROLE_LABELS[role],
            }))}
          />
          <TextField
            label="Nome (opcional)"
            name={`name-${i}`}
            value={p.name}
            onChange={(name) =>
              onChange(value.map((x, j) => (j === i ? { ...x, name } : x)))
            }
          />
          <button
            type="button"
            className="self-end text-xs underline"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-primary self-start text-xs font-semibold underline"
        onClick={() => onChange([...value, { role: "", name: "" }])}
      >
        Adicionar participante
      </button>
    </fieldset>
  );
}

const cleanParticipants = (list: Participant[]) =>
  list
    .filter((p) => p.role)
    .map((p) => ({ role: p.role, ...(p.name.trim() ? { name: p.name.trim() } : {}) }));

/** O médico responsável que elaborou a versão a declara final e apta à apresentação. */
export function FinalizeReportForm({
  companyId,
  reportId,
}: {
  companyId: string;
  reportId: string;
}) {
  const { pending, error, run } = useSubmit();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const note = new FormData(event.currentTarget).get("note");
        run(() =>
          registerReportEventAction(companyId, reportId, {
            kind: "finalized",
            note: note || undefined,
          }),
        );
      }}
    >
      <FormError message={error} />
      <TextField label="Observação do médico (opcional)" name="note" />
      <SubmitButton pending={pending} label="Finalizar versão (médico responsável)" />
    </form>
  );
}

/** Registro de apresentação **já realizada** (não é agendamento). */
export function PresentationForm({
  companyId,
  reportId,
}: {
  companyId: string;
  reportId: string;
}) {
  const { pending, error, fields, run } = useSubmit();
  const [participants, setParticipants] = useState<Participant[]>([
    { role: "", name: "" },
  ]);
  const [cipa, setCipa] = useState("");
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        registerReportEventAction(companyId, reportId, {
          kind: "presented",
          occurredOn: fd.get("occurredOn"),
          modality: fd.get("modality"),
          participants: cleanParticipants(participants),
          cipaSituation: cipa,
          cipaReference: fd.get("cipaReference") || undefined,
          evidenceReference: fd.get("evidenceReference") || undefined,
        }),
      () => setParticipants([{ role: "", name: "" }]),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <TextField
        label="Data em que a apresentação foi realizada"
        name="occurredOn"
        type="date"
        required
        error={fields.occurredOn}
      />
      <SelectField
        label="Modalidade"
        name="modality"
        required
        options={REPORT_MODALITIES.map((value) => ({
          value,
          label: REPORT_MODALITY_LABELS[value],
        }))}
        error={fields.modality}
      />
      <ParticipantsField value={participants} onChange={setParticipants} />
      <SelectField
        label="Situação da CIPA"
        name="cipaSituation"
        required
        value={cipa}
        onChange={setCipa}
        options={CIPA_SITUATIONS.map((value) => ({
          value,
          label: CIPA_SITUATION_LABELS[value],
        }))}
        error={fields.cipaSituation}
      />
      {cipa === "not_constituted" ? (
        <TextField
          label="Como foi verificado que não há CIPA constituída"
          name="cipaReference"
          required
          error={fields.cipaReference}
        />
      ) : null}
      <TextField
        label="Referência da ata ou da evidência (opcional)"
        name="evidenceReference"
        error={fields.evidenceReference}
      />
      <SubmitButton pending={pending} label="Registrar apresentação realizada" />
    </form>
  );
}

type Measure = { description: string; responsible: string; dueDate: string };

/** Registro da discussão efetiva: síntese agregada e medidas propostas (não executadas). */
export function DiscussionForm({
  companyId,
  reportId,
}: {
  companyId: string;
  reportId: string;
}) {
  const { pending, error, fields, run } = useSubmit();
  const [participants, setParticipants] = useState<Participant[]>([
    { role: "", name: "" },
  ]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        registerReportEventAction(companyId, reportId, {
          kind: "discussed",
          occurredOn: fd.get("occurredOn"),
          participants: cleanParticipants(participants),
          summary: fd.get("summary"),
          measures: measures
            .filter((m) => m.description.trim())
            .map((m) => ({
              description: m.description,
              responsible: m.responsible || undefined,
              dueDate: m.dueDate || undefined,
            })),
          evidenceReference: fd.get("evidenceReference") || undefined,
        }),
      () => {
        setParticipants([{ role: "", name: "" }]);
        setMeasures([]);
      },
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <TextField
        label="Data da discussão"
        name="occurredOn"
        type="date"
        required
        error={fields.occurredOn}
      />
      <ParticipantsField value={participants} onChange={setParticipants} />
      <TextAreaField
        label="Síntese do que foi discutido (dados agregados, sem dado clínico individual)"
        name="summary"
        required
        rows={3}
        error={fields.summary}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-text text-sm font-semibold">
          Medidas e encaminhamentos propostos (ficam como propostos, não executados)
        </legend>
        {measures.map((m, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <TextField
              label="Medida ou encaminhamento"
              name={`measure-${i}`}
              value={m.description}
              onChange={(description) =>
                setMeasures(measures.map((x, j) => (j === i ? { ...x, description } : x)))
              }
            />
            <TextField
              label="Responsável (se definido)"
              name={`responsible-${i}`}
              value={m.responsible}
              onChange={(responsible) =>
                setMeasures(measures.map((x, j) => (j === i ? { ...x, responsible } : x)))
              }
            />
            <TextField
              label="Prazo (se definido)"
              name={`due-${i}`}
              type="date"
              value={m.dueDate}
              onChange={(dueDate) =>
                setMeasures(measures.map((x, j) => (j === i ? { ...x, dueDate } : x)))
              }
            />
            <button
              type="button"
              className="self-end text-xs underline"
              onClick={() => setMeasures(measures.filter((_, j) => j !== i))}
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-primary self-start text-xs font-semibold underline"
          onClick={() =>
            setMeasures([...measures, { description: "", responsible: "", dueDate: "" }])
          }
        >
          Adicionar medida
        </button>
      </fieldset>
      <TextField
        label="Referência da ata ou da evidência (opcional)"
        name="evidenceReference"
        error={fields.evidenceReference}
      />
      <SubmitButton pending={pending} label="Registrar discussão realizada" />
    </form>
  );
}

/** Corrige um registro com motivo; o original continua no histórico. */
export function VoidReportEventForm({
  companyId,
  eventId,
}: {
  companyId: string;
  eventId: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useSubmit();
  if (!open)
    return (
      <button
        type="button"
        className="self-start text-xs font-semibold text-amber-900 underline"
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
        run(
          () => voidReportEventAction(companyId, eventId, { reason }),
          () => setOpen(false),
        );
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
