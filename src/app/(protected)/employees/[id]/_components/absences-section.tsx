"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  ABSENCE_CAUSE_LABELS,
  ABSENCE_CAUSES,
  RETURN_EXAM_STATE_LABELS,
  WORK_RELATION_LABELS,
  WORK_RELATIONS,
  type AbsenceAssessment,
  type AbsenceCause,
  type WorkRelation,
} from "@/shared/domains/medicine/absences";
import {
  cancelAbsenceAction,
  confirmAbsenceReturnAction,
  createAbsenceAction,
  updateAbsenceEndAction,
} from "@/shared/server/actions/medicine/absences";

import { FormError, SelectField, SubmitButton, TextField } from "../../../_ui/form";

export type AbsenceItem = {
  id: string;
  cause: AbsenceCause;
  workRelation: WorkRelation;
  startsOn: string;
  endsOn: string | null;
  returnedOn: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  assessment: AbsenceAssessment;
};

type Result =
  | { ok: true }
  | { ok: false; error: { message: string; fields?: Record<string, string> } };

const fmt = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

function useRun() {
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
        setError(result.error.fields ? null : result.error.message);
      }
    });
  return { pending, error, fields, run };
}

function AbsenceActions({ item }: { item: AbsenceItem }) {
  const { pending, error, fields, run } = useRun();
  if (item.cancelledAt || item.returnedOn) return null;
  return (
    <div className="flex flex-col gap-2">
      <FormError message={error} />
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() =>
            confirmAbsenceReturnAction(item.id, { returnedOn: fd.get("returnedOn") }),
          );
        }}
      >
        <TextField
          label="Retorno confirmado em"
          name="returnedOn"
          type="date"
          required
          error={fields.returnedOn}
        />
        <SubmitButton pending={pending} label="Confirmar retorno" />
      </form>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const value = (fd.get("endsOn") as string) || null;
          run(() => updateAbsenceEndAction(item.id, { endsOn: value }));
        }}
      >
        <TextField
          label="Último dia previsto"
          name="endsOn"
          type="date"
          defaultValue={item.endsOn ?? undefined}
          error={fields.endsOn}
        />
        <SubmitButton pending={pending} label="Atualizar previsão" />
      </form>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => cancelAbsenceAction(item.id, { reason: fd.get("reason") }));
        }}
      >
        <TextField label="Motivo do cancelamento" name="reason" error={fields.reason} />
        <SubmitButton pending={pending} label="Cancelar registro" />
      </form>
    </div>
  );
}

/**
 * Afastamentos do funcionário (NOB-139): registro administrativo, alerta de exame de retorno
 * (NR-7 7.5.9, sugestão para o médico) e sinalização informativa da NR-7 7.5.19.5 c. Nenhum CID
 * ou atestado aparece aqui: a área clínica é do coordenador vinculado.
 */
export function AbsencesSection({
  employeeId,
  items,
  loadError,
}: {
  employeeId: string;
  items: AbsenceItem[];
  loadError: string | null;
}) {
  const { pending, error, fields, run } = useRun();
  const [cause, setCause] = useState<AbsenceCause | "">("");

  return (
    <section
      aria-labelledby="absences-title"
      className="glass-card flex flex-col gap-4 p-4 text-sm"
    >
      <h2 id="absences-title" className="text-text text-lg font-semibold">
        Afastamentos
      </h2>
      <p className="text-text-subtle">
        Registro administrativo do período. Atestado, CID e diagnóstico não ficam aqui: só
        o médico coordenador do PCMSO os registra, na área clínica. O alerta de exame de
        retorno é sugestão; quem decide a conduta e a aptidão é o médico.
      </p>
      {loadError ? <p role="alert">{loadError}</p> : null}
      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const a = item.assessment;
            return (
              <li key={item.id} className="border-border rounded-lg border p-3">
                <p className="text-text font-semibold">
                  {ABSENCE_CAUSE_LABELS[item.cause]} ·{" "}
                  {WORK_RELATION_LABELS[item.workRelation]}
                </p>
                <p className="text-text-subtle">
                  Início {fmt(item.startsOn)} · último dia{" "}
                  {item.endsOn ? fmt(item.endsOn) : "não informado"} ·{" "}
                  {item.cancelledAt
                    ? `cancelado (${item.cancelReason})`
                    : item.returnedOn
                      ? `retorno confirmado em ${fmt(item.returnedOn)}`
                      : "em andamento, retorno não confirmado"}{" "}
                  · {a.elapsedDays} dia(s)
                </p>
                {item.cancelledAt ? null : (
                  <>
                    <p role="status" className="mt-1">
                      <strong>{RETURN_EXAM_STATE_LABELS[a.returnExam.state]}:</strong>{" "}
                      {a.returnExam.reason}
                      {a.returnExam.mustBeDoneBefore
                        ? ` Antes de ${fmt(a.returnExam.mustBeDoneBefore)}.`
                        : ""}{" "}
                      {a.returnExam.recordedOn
                        ? `Exame de retorno registrado em ${fmt(a.returnExam.recordedOn)}.`
                        : a.returnExam.state === "required"
                          ? "Nenhum exame de retorno registrado (o agendamento não é controlado aqui)."
                          : ""}
                    </p>
                    {a.socialSecurityReferral?.flagged ? (
                      <p className="mt-1 rounded bg-amber-50 p-2 text-amber-900">
                        {a.socialSecurityReferral.reason}
                      </p>
                    ) : null}
                    <Link
                      href={`/absences/${item.id}/clinical`}
                      className="text-primary mt-1 inline-block underline"
                    >
                      Área clínica (só o coordenador do PCMSO)
                    </Link>
                    <AbsenceActions item={item} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-text-subtle">Nenhum afastamento registrado.</p>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          run(
            () =>
              createAbsenceAction(employeeId, {
                cause: fd.get("cause") || undefined,
                workRelation: fd.get("workRelation") || undefined,
                startsOn: fd.get("startsOn"),
                endsOn: (fd.get("endsOn") as string) || undefined,
              }),
            () => {
              form.reset();
              setCause("");
            },
          );
        }}
      >
        <h3 className="text-text font-semibold">Registrar afastamento</h3>
        <FormError message={error} />
        <SelectField
          label="Causa"
          name="cause"
          required
          value={cause}
          onChange={(v) => setCause(v as AbsenceCause)}
          options={ABSENCE_CAUSES.map((c) => ({
            value: c,
            label: ABSENCE_CAUSE_LABELS[c],
          }))}
          emptyLabel="— selecione —"
          error={fields.cause}
        />
        {cause && cause !== "other" ? (
          <SelectField
            label="Relação com o trabalho (se informada)"
            name="workRelation"
            defaultValue="not_determined"
            options={WORK_RELATIONS.map((w) => ({
              value: w,
              label: WORK_RELATION_LABELS[w],
            }))}
            error={fields.workRelation}
          />
        ) : null}
        <TextField
          label="Início"
          name="startsOn"
          type="date"
          required
          error={fields.startsOn}
        />
        <TextField
          label="Último dia (se conhecido)"
          name="endsOn"
          type="date"
          error={fields.endsOn}
        />
        <SubmitButton pending={pending} label="Registrar afastamento" />
      </form>
    </section>
  );
}
