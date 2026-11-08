"use client";

import { useId, type FormEvent } from "react";

import { pathDescriber } from "@/shared/domains/medicine/form-feedback";
import {
  addExamPlanItemAction,
  approveExamPlanAction,
  createExamPlanDraftAction,
  decideExamPlanItemAction,
} from "@/shared/server/actions/medicine/exam-plans";

import {
  FieldError,
  FormError,
  SubmitButton,
  TextField,
  fieldClass,
} from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

/** Falha sem resposta do servidor (rede, erro inesperado): nada se perde do que foi digitado. */
const UNEXPECTED_ERROR_MESSAGE =
  "Não foi possível concluir agora. Verifique a conexão e tente de novo; o que você digitou foi mantido.";

const describePlanPath = pathDescriber({
  fields: {
    decision: "Decisão",
    periodicity: "Periodicidade",
    justification: "Justificativa",
    exposureGroup: "Grupo de exposição",
    jobRole: "Função",
    code: "Código do procedimento",
    otherDescription: "Descrição do procedimento",
    note: "Observação da aprovação",
  },
});

/**
 * Envio dos formulários do plano. Só limpa o formulário depois do sucesso confirmado pelo
 * servidor (`onOk`); erro de campo, erro do servidor ou falha de rede mantêm os valores. Erro
 * sem lugar na tela aparece no resumo; um segundo envio enquanto o primeiro está pendente é
 * ignorado (NOB-112).
 */
const useSubmit = () =>
  useActionFeedback({
    describe: describePlanPath,
    unexpectedMessage: UNEXPECTED_ERROR_MESSAGE,
  });

/** A equipe prepara o rascunho a partir da proposta atual (riscos validados). */
export function CreateDraftButton({ companyId }: { companyId: string }) {
  const { pending, feedback, run } = useSubmit();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createExamPlanDraftAction(companyId));
      }}
      className="flex flex-col gap-2"
    >
      <FormError message={feedback.formError} details={feedback.details} />
      <SubmitButton pending={pending} label="Preparar rascunho a partir da proposta" />
    </form>
  );
}

/**
 * Decisão da coordenadora sobre um item (manter/retirar e periodicidade). Abre com a decisão, a
 * periodicidade e a justificativa já registradas (NOB-112): alterar um campo não apaga os demais.
 * Limpar a justificativa é deliberado; o servidor recusa quando ela é obrigatória.
 */
export function ItemDecisionForm({
  planId,
  itemId,
  decision,
  periodicity,
  justification,
  origin,
}: {
  planId: string;
  itemId: string;
  decision: "kept" | "removed";
  periodicity: string;
  justification: string | null;
  origin: "suggested" | "added";
}) {
  const { pending, feedback, run } = useSubmit();
  const decisionErrorId = useId();
  const decisionError = feedback.fields.decision;
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        decideExamPlanItemAction(planId, itemId, {
          decision: fd.get("decision"),
          periodicity: fd.get("periodicity"),
          justification: (fd.get("justification") as string) || undefined,
        }),
      { slots: ["decision", "periodicity", "justification"] },
    );
  }
  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2">
      <FormError message={feedback.formError} details={feedback.details} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-text font-semibold">Decisão</span>
        <select
          name="decision"
          defaultValue={decision}
          className={fieldClass}
          aria-invalid={decisionError ? true : undefined}
          aria-describedby={decisionError ? decisionErrorId : undefined}
        >
          <option value="kept">Manter</option>
          <option value="removed">Retirar</option>
        </select>
        <FieldError id={decisionErrorId} message={decisionError} />
      </label>
      <TextField
        label="Periodicidade"
        name="periodicity"
        required
        isFullWidth
        defaultValue={periodicity}
        error={feedback.fields.periodicity}
      />
      <TextField
        label={
          origin === "added"
            ? "Justificativa (obrigatória para exame acrescentado)"
            : "Justificativa (obrigatória para retirar)"
        }
        name="justification"
        isFullWidth
        defaultValue={justification ?? ""}
        error={feedback.fields.justification}
      />
      <SubmitButton pending={pending} label="Registrar decisão" />
    </form>
  );
}

const ADD_ITEM_SLOTS = [
  "exposureGroup",
  "jobRole",
  "code",
  "otherDescription",
  "periodicity",
  "justification",
] as const;

/** Exame acrescentado pela coordenadora (código da Tabela 27, com justificativa). */
export function AddItemForm({ planId }: { planId: string }) {
  const { pending, feedback, succeeded, run } = useSubmit();
  const fields = feedback.fields;
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    run(
      () =>
        addExamPlanItemAction(planId, {
          exposureGroup: fd.get("exposureGroup"),
          jobRole: fd.get("jobRole") ?? "",
          code: fd.get("code"),
          otherDescription: (fd.get("otherDescription") as string) || undefined,
          periodicity: fd.get("periodicity"),
          justification: fd.get("justification"),
        }),
      // Limpa só depois do sucesso: um novo clique não reenvia o mesmo exame.
      { slots: ADD_ITEM_SLOTS, onOk: () => form.reset() },
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {succeeded ? (
        <p
          role="status"
          className="rounded-field border border-emerald-300 bg-emerald-50/80 px-3.5 py-2.5 text-[13px] text-emerald-800"
        >
          Exame acrescentado ao plano. O formulário foi limpo para o próximo.
        </p>
      ) : null}
      <FormError message={feedback.formError} details={feedback.details} />
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
  const { pending, feedback, run } = useSubmit();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () =>
            approveExamPlanAction(planId, {
              note: (fd.get("note") as string) || undefined,
            }),
          { slots: ["note"] },
        );
      }}
      className="flex flex-col gap-3"
    >
      <FormError message={feedback.formError} details={feedback.details} />
      <TextField
        label="Observação da aprovação (opcional)"
        name="note"
        isFullWidth
        error={feedback.fields.note}
      />
      <SubmitButton pending={pending} label="Aprovar plano" />
    </form>
  );
}
