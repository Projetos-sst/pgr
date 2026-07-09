import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getRiskAssessmentAction } from "@/shared/server/actions/pgr/risk-assessments";
import { getRiskMethodologyAction } from "@/shared/server/actions/pgr/risk-methodology";
import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";

import { PageHeader } from "../../../../../_ui/list";
import { AssessmentForm } from "../../_components/assessment-form";

export const dynamic = "force-dynamic";

export default async function EditRiskAssessmentPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  await requireOfficeStaffPage();
  const { id: riskId, assessmentId } = await params;

  const result = await getRiskAssessmentAction(assessmentId);
  if (!result.ok) notFound();
  const assessment = result.data;

  const methodologyResult = await getRiskMethodologyAction();
  const methodology = methodologyResult.ok
    ? methodologyResult.data
    : { ...defaultRiskMethodology(), configured: false };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Editar avaliação" />
      <AssessmentForm
        riskId={riskId}
        assessmentId={assessment.id}
        bands={methodology.classificationBands}
        configured={methodology.configured}
        initial={{
          criterion: assessment.criterion,
          probability: assessment.probability,
          severity: assessment.severity,
          uncertaintyDegree: assessment.uncertaintyDegree,
          toleranceLimit: assessment.toleranceLimit,
          assessedAt: assessment.assessedAt,
        }}
      />
    </div>
  );
}
