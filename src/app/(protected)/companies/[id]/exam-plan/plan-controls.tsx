"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  addExamPlanItemAction,
  approveExamPlanAction,
  createExamPlanDraftAction,
  decideExamPlanItemAction,
} from "@/shared/server/actions/medicine/exam-plans";

import { FormError, SubmitButton, TextField, fieldClass } from "../../../_ui/form";

type Result =
  | { ok: true }
  | { ok: false; error: { message: string; fields?: Record<string, string> } };

function useSubmit() {
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
        setError(result.error.fields ? null : result.error.message);
      }
    });
  return { pending, error, fields, run };
}

/** A equipe prepara o rascunho a partir da proposta atual (riscos validados). */
export function CreateDraftButton({ companyId }: { companyId: string }) {
  const { pending, error, run } = useSubmit();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createExamPlanDraftAction(companyId));
      }}
      className="flex flex-col gap-2"
    >
      <FormError message={error} />
      <SubmitButton pending={pending} label="Preparar rascunho a partir da proposta" />
    </form>
  );
}

/** Decisão da coordenadora sobre um item (manter/retirar e periodicidade). */
export function ItemDecisionForm({
  planId,
  itemId,
  decision,
  periodicity,
}: {
  planId: string;
  itemId: string;
  decision: "kept" | "removed";
  periodicity: string;
}) {
  const { pending, error, fields, run } = useSubmit();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(() =>
      decideExamPlanItemAction(planId, itemId, {
        decision: fd.get("decision"),
        periodicity: fd.get("periodicity"),
        justification: (fd.get("justification") as string) || undefined,
      }),
    );
  }
  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2">
      <FormError message={error} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text font-semibold">Decisão</span>
        <select name="decision" defaultValue={decision} className={fieldClass}>
          <option value="kept">Manter</option>
          <option value="removed">Retirar</option>
        </select>
      </label>
      <TextField
        label="Periodicidade"
        name="periodicity"
        required
        isFullWidth
        defaultValue={periodicity}
        error={fields.periodicity}
      />
      <TextField
        label="Justificativa (obrigatória para retirar)"
        name="justification"
        isFullWidth
        error={fields.justification}
      />
      <SubmitButton pending={pending} label="Registrar decisão" />
    </form>
  );
}

/** Exame acrescentado pela coordenadora (código da Tabela 27, com justificativa). */
export function AddItemForm({ planId }: { planId: string }) {
  const { pending, error, fields, run } = useSubmit();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(() =>
      addExamPlanItemAction(planId, {
        exposureGroup: fd.get("exposureGroup"),
        jobRole: fd.get("jobRole") ?? "",
        code: fd.get("code"),
        otherDescription: (fd.get("otherDescription") as string) || undefined,
        periodicity: fd.get("periodicity"),
        justification: fd.get("justification"),
      }),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <TextField
        label="Grupo de exposição"
        name="exposureGroup"
        required
        error={fields.exposureGroup}
      />
      <TextField label="Função (opcional)" name="jobRole" error={fields.jobRole} />
      <TextField
        label="Código do procedimento (Tabela 27)"
        name="code"
        required
        isMono
        error={fields.code}
      />
      <TextField
        label="Descrição (só para o código 9999)"
        name="otherDescription"
        error={fields.otherDescription}
      />
      <TextField
        label="Periodicidade"
        name="periodicity"
        required
        isFullWidth
        error={fields.periodicity}
      />
      <TextField
        label="Justificativa"
        name="justification"
        required
        isFullWidth
        error={fields.justification}
      />
      <SubmitButton pending={pending} label="Acrescentar exame" />
    </form>
  );
}

export function ApproveForm({ planId }: { planId: string }) {
  const { pending, error, fields, run } = useSubmit();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() =>
          approveExamPlanAction(planId, {
            note: (fd.get("note") as string) || undefined,
          }),
        );
      }}
      className="flex flex-col gap-3"
    >
      <FormError message={error} />
      <TextField
        label="Observação da aprovação (opcional)"
        name="note"
        isFullWidth
        error={fields.note}
      />
      <SubmitButton pending={pending} label="Aprovar plano" />
    </form>
  );
}
