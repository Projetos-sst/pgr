import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listLinkableCampaignsAction } from "@/shared/server/actions/pgr/ergonomic-evaluations";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import { todayInSaoPaulo } from "@/shared/dates";

import { PageHeader } from "../../../../_ui/list";
import { ErgonomicEvaluationForm } from "../_components/ergonomic-evaluation-form";
import { riskShortLabel } from "../../_components/risk-short-label";

export const dynamic = "force-dynamic";

export default async function NewErgonomicEvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id: riskId } = await params;

  const riskResult = await getRiskAction(riskId);
  if (!riskResult.ok) notFound();

  const campaignsResult = await listLinkableCampaignsAction(riskId);

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref={`/risks/${riskId}/ergonomic-evaluations`}
        title="Nova avaliação ergonômica"
        description={riskResult.data.description}
      />
      <ErgonomicEvaluationForm
        riskId={riskId}
        initial={{ assessedAt: todayInSaoPaulo() }}
        campaigns={campaignsResult.ok ? campaignsResult.data : []}
        returnLabel={riskShortLabel(riskResult.data.description)}
      />
    </div>
  );
}
