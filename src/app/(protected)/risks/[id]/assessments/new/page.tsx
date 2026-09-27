import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import { getRiskMethodologyAction } from "@/shared/server/actions/pgr/risk-methodology";
import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";
import { isNr09EligibleAgent } from "@/shared/domains/pgr/nr09";

import { PageHeader } from "../../../../_ui/list";
import { AssessmentForm } from "../_components/assessment-form";

export const dynamic = "force-dynamic";

export default async function NewRiskAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id: riskId } = await params;

  const riskResult = await getRiskAction(riskId);
  if (!riskResult.ok) notFound();

  const methodologyResult = await getRiskMethodologyAction();
  const methodology = methodologyResult.ok
    ? methodologyResult.data
    : { ...defaultRiskMethodology(), configured: false };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref={`/risks/${riskId}`}
        title="Nova avaliação"
        description={riskResult.data.description}
      />
      <AssessmentForm
        riskId={riskId}
        bands={methodology.classificationBands}
        configured={methodology.configured}
        initial={{ assessedAt: today }}
        nr09Eligible={isNr09EligibleAgent(riskResult.data.agentType)}
      />
    </div>
  );
}
