"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

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
  compactRows,
  EMPTY_FORM_FEEDBACK,
  formFeedback,
  pathDescriber,
  remapListIndexes,
  unexpectedFormFeedback,
  type FormFeedback,
} from "@/shared/domains/medicine/form-feedback";
import {
  registerReportEventAction,
  voidReportEventAction,
} from "@/shared/server/actions/medicine/analytical-reports";

import {
  FieldError,
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_ui/form";

type Result =
  | { ok: true }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };

type Fields = Record<string, string>;

type RunOptions = {
  /** Chaves de erro que o formulário mostra junto ao campo ou à seção. */
  slots: readonly string[];
  /** Ajusta as chaves do servidor ao que a tela mostra (índice da linha na tela). */
  mapFields?: (fields: Fields | undefined) => Fields | undefined;
  onOk?: () => void;
};

const describeReportPath = pathDescriber({
  fields: {
    occurredOn: "Data",
    modality: "Modalidade",
    participants: "Participantes",
    cipaSituation: "Situação da CIPA",
    cipaReference: "Verificação da ausência de CIPA",
    evidenceReference: "Referência da ata ou da evidência",
    summary: "Síntese da discussão",
    measures: "Medidas e encaminhamentos",
    note: "Observação do médico",
    reason: "Motivo da correção",
  },
  lists: {
    participants: { item: "Participante", fields: { role: "função", name: "nome" } },
    measures: {
      item: "Medida",
      fields: { description: "descrição", responsible: "responsável", dueDate: "prazo" },
    },
  },
});

function useSubmit() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback>(EMPTY_FORM_FEEDBACK);
  const run = (fn: () => Promise<Result>, options: RunOptions) =>
    startTransition(async () => {
      let result: Result;
      try {
        result = await fn();
      } catch {
        // Falha não mapeada (o servidor já registrou): mensagem segura, sem detalhe.
        setFeedback(unexpectedFormFeedback());
        return;
      }
      if (result.ok) {
        setFeedback(EMPTY_FORM_FEEDBACK);
        options.onOk?.();
        router.refresh();
        return;
      }
      const fields = options.mapFields
        ? options.mapFields(result.error.fields)
        : result.error.fields;
      setFeedback(
        formFeedback(
          { ...result.error, fields },
          { slots: options.slots, describe: describeReportPath },
        ),
      );
    });
  return { pending, feedback, run };
}

type Participant = { role: ReportParticipantRole | ""; name: string };

const participantSlots = (count: number) => [
  "participants",
  ...Array.from({ length: count }, (_, i) => [
    `participants.${i}.role`,
    `participants.${i}.name`,
  ]).flat(),
];

/**
 * Só a linha totalmente em branco (a vazia padrão) fica de fora; linha com nome e sem função
 * segue para o servidor e volta como erro na própria linha, em vez de sumir sem aviso.
 */
function participantsPayload(list: Participant[]) {
  const { values, indexes } = compactRows(list, (p) => !p.role && !p.name.trim());
  return {
    participants: values.map((p) => ({
      role: p.role,
      ...(p.name.trim() ? { name: p.name.trim() } : {}),
    })),
    indexes,
  };
}

/** Funções representadas (e, se quiser, nomes). Nenhum dado clínico ou documento pessoal. */
function ParticipantsField({
  value,
  onChange,
  fields,
}: {
  value: Participant[];
  onChange: (next: Participant[]) => void;
  fields: Fields;
}) {
  const errorId = useId();
  const sectionError = fields.participants;
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={sectionError ? errorId : undefined}
    >
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
            error={fields[`participants.${i}.role`]}
          />
          <TextField
            label="Nome (opcional)"
            name={`name-${i}`}
            value={p.name}
            onChange={(name) =>
              onChange(value.map((x, j) => (j === i ? { ...x, name } : x)))
            }
            error={fields[`participants.${i}.name`]}
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
      <FieldError id={errorId} message={sectionError} />
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

/** O médico responsável que elaborou a versão a declara final e apta à apresentação. */
export function FinalizeReportForm({
  companyId,
  reportId,
}: {
  companyId: string;
  reportId: string;
}) {
  const { pending, feedback, run } = useSubmit();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const note = new FormData(event.currentTarget).get("note");
        run(
          () =>
            registerReportEventAction(companyId, reportId, {
              kind: "finalized",
              note: note || undefined,
            }),
          { slots: ["note"] },
        );
      }}
    >
      <FormError message={feedback.formError} details={feedback.details} />
      <TextField
        label="Observação do médico (opcional)"
        name="note"
        error={feedback.fields.note}
      />
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
  const { pending, feedback, run } = useSubmit();
  const { fields } = feedback;
  const [participants, setParticipants] = useState<Participant[]>([
    { role: "", name: "" },
  ]);
  const [cipa, setCipa] = useState("");
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const sent = participantsPayload(participants);
    run(
      () =>
        registerReportEventAction(companyId, reportId, {
          kind: "presented",
          occurredOn: fd.get("occurredOn"),
          modality: fd.get("modality"),
          participants: sent.participants,
          cipaSituation: cipa,
          cipaReference: fd.get("cipaReference") || undefined,
          evidenceReference: fd.get("evidenceReference") || undefined,
        }),
      {
        slots: [
          "occurredOn",
          "modality",
          "cipaSituation",
          "evidenceReference",
          ...(cipa === "not_constituted" ? ["cipaReference"] : []),
          ...participantSlots(participants.length),
        ],
        mapFields: (f) => remapListIndexes(f, "participants", sent.indexes),
        onOk: () => setParticipants([{ role: "", name: "" }]),
      },
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
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
      <ParticipantsField
        value={participants}
        onChange={setParticipants}
        fields={fields}
      />
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

const measureSlots = (count: number) => [
  "measures",
  ...Array.from({ length: count }, (_, i) => [
    `measures.${i}.description`,
    `measures.${i}.responsible`,
    `measures.${i}.dueDate`,
  ]).flat(),
];

/** Registro da discussão efetiva: síntese agregada e medidas propostas (não executadas). */
export function DiscussionForm({
  companyId,
  reportId,
}: {
  companyId: string;
  reportId: string;
}) {
  const { pending, feedback, run } = useSubmit();
  const { fields } = feedback;
  const measuresErrorId = useId();
  const [participants, setParticipants] = useState<Participant[]>([
    { role: "", name: "" },
  ]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const sentParticipants = participantsPayload(participants);
    // Só a linha toda em branco fica de fora: medida sem descrição, mas com responsável ou
    // prazo, volta como erro na linha em vez de ser descartada sem aviso.
    const sentMeasures = compactRows(
      measures,
      (m) => !m.description.trim() && !m.responsible.trim() && !m.dueDate,
    );
    run(
      () =>
        registerReportEventAction(companyId, reportId, {
          kind: "discussed",
          occurredOn: fd.get("occurredOn"),
          participants: sentParticipants.participants,
          summary: fd.get("summary"),
          measures: sentMeasures.values.map((m) => ({
            description: m.description,
            responsible: m.responsible || undefined,
            dueDate: m.dueDate || undefined,
          })),
          evidenceReference: fd.get("evidenceReference") || undefined,
        }),
      {
        slots: [
          "occurredOn",
          "summary",
          "evidenceReference",
          ...participantSlots(participants.length),
          ...measureSlots(measures.length),
        ],
        mapFields: (f) =>
          remapListIndexes(
            remapListIndexes(f, "participants", sentParticipants.indexes),
            "measures",
            sentMeasures.indexes,
          ),
        onOk: () => {
          setParticipants([{ role: "", name: "" }]);
          setMeasures([]);
        },
      },
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={feedback.formError} details={feedback.details} />
      <TextField
        label="Data da discussão"
        name="occurredOn"
        type="date"
        required
        error={fields.occurredOn}
      />
      <ParticipantsField
        value={participants}
        onChange={setParticipants}
        fields={fields}
      />
      <TextAreaField
        label="Síntese do que foi discutido (dados agregados, sem dado clínico individual)"
        name="summary"
        required
        rows={3}
        error={fields.summary}
      />
      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={fields.measures ? measuresErrorId : undefined}
      >
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
              error={fields[`measures.${i}.description`]}
            />
            <TextField
              label="Responsável (se definido)"
              name={`responsible-${i}`}
              value={m.responsible}
              onChange={(responsible) =>
                setMeasures(measures.map((x, j) => (j === i ? { ...x, responsible } : x)))
              }
              error={fields[`measures.${i}.responsible`]}
            />
            <TextField
              label="Prazo (se definido)"
              name={`due-${i}`}
              type="date"
              value={m.dueDate}
              onChange={(dueDate) =>
                setMeasures(measures.map((x, j) => (j === i ? { ...x, dueDate } : x)))
              }
              error={fields[`measures.${i}.dueDate`]}
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
        <FieldError id={measuresErrorId} message={fields.measures} />
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
  const { pending, feedback, run } = useSubmit();
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
        run(() => voidReportEventAction(companyId, eventId, { reason }), {
          slots: ["reason"],
          onOk: () => setOpen(false),
        });
      }}
    >
      {/* Permissão ou regra do servidor ficam no resumo; só a validação do motivo vai ao campo. */}
      <FormError message={feedback.formError} details={feedback.details} />
      <TextAreaField
        label="Motivo da correção"
        name="reason"
        required
        rows={2}
        error={feedback.fields.reason}
      />
      <SubmitButton pending={pending} label="Registrar correção" />
    </form>
  );
}
