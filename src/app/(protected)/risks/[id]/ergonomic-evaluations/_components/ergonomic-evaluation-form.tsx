"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  AET_DOC_TYPE,
  ERGONOMIC_ADEQUACIES,
  ERGONOMIC_DIMENSION_GROUPS,
  ERGONOMIC_METHOD_SUGGESTIONS,
  ergonomicAdequacyLabel,
  ergonomicDimensionLabel,
  ergonomicDimensionNotesKey,
  formatCampaignPeriod,
  type ErgonomicDimension,
  type ErgonomicEvaluationInput,
} from "@/shared/domains/pgr/ergonomics";
import {
  createErgonomicEvaluationAction,
  updateErgonomicEvaluationAction,
} from "@/shared/server/actions/pgr/ergonomic-evaluations";
import type { ActionError } from "@/shared/server/result";

import {
  CancelLink,
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../../_ui/form";

const ADEQUACY_OPTIONS = ERGONOMIC_ADEQUACIES.map((value) => ({
  value,
  label: ergonomicAdequacyLabel(value),
}));

export type LinkableCampaign = {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
};

export type ErgonomicEvaluationFormInitial = {
  assessedAt: string;
  responsible?: string | null;
  method?: string | null;
  notes?: string | null;
  psychosocialCampaignId?: string | null;
} & Partial<Record<ErgonomicDimension | `${ErgonomicDimension}Notes`, string | null>>;

function campaignOption(campaign: LinkableCampaign) {
  const period = formatCampaignPeriod(campaign.startsAt, campaign.endsAt);
  return {
    value: campaign.id,
    label: period ? `${campaign.name} (${period})` : campaign.name,
  };
}

/**
 * Formulário da avaliação ergonômica (NR-17, issue #40). Cartões por tema no wrapper
 * central de 940px — o mesmo vocabulário visual dos formulários corrigidos no Lote 2.
 *
 * Cada dimensão é adequação (select de três estados) + observação livre. Não há
 * conclusão geral: deixar em branco significa "não avaliado", e o documento imprime
 * exatamente isso.
 */
export function ErgonomicEvaluationForm({
  riskId,
  evaluationId,
  initial,
  campaigns,
  returnLabel,
}: {
  riskId: string;
  evaluationId?: string;
  initial: ErgonomicEvaluationFormInitial;
  /** Campanhas psicossociais encerradas da mesma unidade — pode vir vazio. */
  campaigns: LinkableCampaign[];
  /** Rótulo curto do risco, usado no retorno do upload da AET. */
  returnLabel: string;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const listPath = `/risks/${riskId}/ergonomic-evaluations`;
  const aetHref =
    `/documents/new?relatedEntityType=risk&relatedEntityId=${riskId}` +
    `&docType=${encodeURIComponent(AET_DOC_TYPE)}` +
    `&returnTo=${encodeURIComponent(listPath)}` +
    `&returnLabel=${encodeURIComponent(returnLabel)}`;

  function applyError(error: ActionError) {
    setErrors(error.fields ?? {});
    setFormError(error.fields ? null : error.message);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const read = (name: string) => String(fd.get(name) ?? "");
    const input = {
      assessedAt: read("assessedAt"),
      responsible: read("responsible"),
      method: read("method"),
      notes: read("notes"),
      psychosocialCampaignId: read("psychosocialCampaignId"),
    } as Record<string, string>;
    for (const group of ERGONOMIC_DIMENSION_GROUPS) {
      for (const dimension of group.dimensions) {
        input[dimension] = read(dimension);
        input[ergonomicDimensionNotesKey(dimension)] = read(
          ergonomicDimensionNotesKey(dimension),
        );
      }
    }

    startTransition(async () => {
      const payload = input as unknown as ErgonomicEvaluationInput;
      const result = evaluationId
        ? await updateErgonomicEvaluationAction(riskId, evaluationId, payload)
        : await createErgonomicEvaluationAction(riskId, payload);
      if (result.ok) {
        router.push(listPath);
        router.refresh();
        return;
      }
      applyError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[22px]">
      <FormError message={formError} />

      <FormSection title="Identificação da avaliação">
        <TextField
          label="Data da avaliação"
          name="assessedAt"
          type="date"
          required
          defaultValue={initial.assessedAt}
          error={errors.assessedAt}
        />
        <TextField
          label="Responsável pela avaliação"
          name="responsible"
          placeholder="Nome do profissional que realizou a avaliação"
          defaultValue={initial.responsible ?? ""}
          error={errors.responsible}
        />
        <TextField
          label="Método / instrumento"
          name="method"
          suggestions={ERGONOMIC_METHOD_SUGGESTIONS}
          placeholder="Ex.: AEP — inspeção do posto de trabalho"
          defaultValue={initial.method ?? ""}
          error={errors.method}
          isFullWidth
        />
        <SelectField
          label="Campanha psicossocial vinculada (opcional)"
          name="psychosocialCampaignId"
          defaultValue={initial.psychosocialCampaignId ?? ""}
          options={campaigns.map(campaignOption)}
          emptyLabel="— sem campanha vinculada —"
          disabled={campaigns.length === 0}
          error={errors.psychosocialCampaignId}
          isFullWidth
        />
        <p className="text-text-subtle text-xs sm:col-span-full">
          {campaigns.length === 0
            ? "Nenhuma campanha psicossocial encerrada nesta unidade. O vínculo é opcional — a avaliação continua válida sem ele."
            : "Ao vincular, o PGR mostra apenas o resultado agregado da campanha (período, nº de respostas e fatores derivados). Nenhuma resposta individual é exibida e o sistema não calcula escore COPSOQ."}
        </p>
      </FormSection>

      {ERGONOMIC_DIMENSION_GROUPS.map((group) => (
        <FormSection key={group.title} title={group.title}>
          {group.dimensions.map((dimension) => (
            <div key={dimension} className="contents">
              <SelectField
                label={ergonomicDimensionLabel(dimension)}
                name={dimension}
                defaultValue={initial[dimension] ?? ""}
                options={ADEQUACY_OPTIONS}
                emptyLabel="— não avaliado —"
                error={errors[dimension]}
              />
              <TextAreaField
                label={`Observação — ${ergonomicDimensionLabel(dimension).toLowerCase()}`}
                name={ergonomicDimensionNotesKey(dimension)}
                rows={2}
                defaultValue={initial[ergonomicDimensionNotesKey(dimension)] ?? ""}
                error={errors[ergonomicDimensionNotesKey(dimension)]}
                isFullWidth={false}
              />
            </div>
          ))}
        </FormSection>
      ))}

      <FormSection title="Observações gerais" columns={1}>
        <TextAreaField
          label="Observações"
          name="notes"
          rows={4}
          placeholder="Contexto da avaliação, recomendações e demais anotações do profissional."
          defaultValue={initial.notes ?? ""}
          error={errors.notes}
        />
        <p className="text-text-subtle text-xs">
          A <strong>AET</strong> (análise ergonômica do trabalho) é um laudo: anexe o
          arquivo ao risco pelo acervo de documentos, que já versiona e mantém o
          histórico.{" "}
          <Link href={aetHref} className="text-primary font-semibold hover:underline">
            Anexar laudo (AET)
          </Link>
        </p>
      </FormSection>

      <FieldError message={errors._} />
      <FormActions>
        <CancelLink href={listPath} />
        <SubmitButton
          pending={pending}
          label={evaluationId ? "Salvar alterações" : "Criar avaliação"}
        />
      </FormActions>
    </form>
  );
}
