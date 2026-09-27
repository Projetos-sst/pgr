import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getErgonomicEvaluationAction,
  listLinkableCampaignsAction,
} from "@/shared/server/actions/pgr/ergonomic-evaluations";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";

import { PageHeader } from "../../../../../_ui/list";
import { ErgonomicEvaluationForm } from "../../_components/ergonomic-evaluation-form";
import { riskShortLabel } from "../../../_components/risk-short-label";

export const dynamic = "force-dynamic";

export default async function EditErgonomicEvaluationPage({
  params,
}: {
  params: Promise<{ id: string; evaluationId: string }>;
}) {
  await requireOfficeStaffPage();
  const { id: riskId, evaluationId } = await params;

  const [riskResult, evaluationResult] = await Promise.all([
    getRiskAction(riskId),
    getErgonomicEvaluationAction(evaluationId),
  ]);
  if (!riskResult.ok || !evaluationResult.ok) notFound();
  const evaluation = evaluationResult.data;
  // Avaliação de outro risco do mesmo tenant não é editável por esta rota.
  if (evaluation.riskId !== riskId) notFound();

  const campaignsResult = await listLinkableCampaignsAction(riskId);

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref={`/risks/${riskId}/ergonomic-evaluations`}
        title="Editar avaliação ergonômica"
        description={riskResult.data.description}
      />
      <ErgonomicEvaluationForm
        riskId={riskId}
        evaluationId={evaluation.id}
        initial={{
          assessedAt: evaluation.assessedAt,
          responsible: evaluation.responsible,
          method: evaluation.method,
          notes: evaluation.notes,
          psychosocialCampaignId: evaluation.psychosocialCampaignId,
          posture: evaluation.posture,
          postureNotes: evaluation.postureNotes,
          movements: evaluation.movements,
          movementsNotes: evaluation.movementsNotes,
          physicalLoad: evaluation.physicalLoad,
          physicalLoadNotes: evaluation.physicalLoadNotes,
          mentalLoad: evaluation.mentalLoad,
          mentalLoadNotes: evaluation.mentalLoadNotes,
          workOrganization: evaluation.workOrganization,
          workOrganizationNotes: evaluation.workOrganizationNotes,
          physicalEnvironment: evaluation.physicalEnvironment,
          physicalEnvironmentNotes: evaluation.physicalEnvironmentNotes,
        }}
        campaigns={campaignsResult.ok ? campaignsResult.data : []}
        returnLabel={riskShortLabel(riskResult.data.description)}
      />
    </div>
  );
}
