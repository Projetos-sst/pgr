import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import { riskClassificationSchema } from "@/shared/domains/pgr/methodology";
import { getCurrentRiskAssessmentAction } from "@/shared/server/actions/pgr/risk-assessments";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";

import { PageHeader } from "../../../../_ui/list";
import { ControlMeasureForm } from "../_components/control-measure-form";
import { RiskContext } from "../_components/risk-context";

export const dynamic = "force-dynamic";

export default async function NewControlMeasurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id: riskId } = await params;

  const riskResult = await getRiskAction(riskId);
  if (!riskResult.ok) notFound();

  const assessmentResult = await getCurrentRiskAssessmentAction(riskId);
  const currentAssessment = assessmentResult.ok ? assessmentResult.data : null;
  // `result` é texto no banco: só vale como classificação se for um valor conhecido.
  const riskClassification =
    riskClassificationSchema.safeParse(currentAssessment?.result).data ?? null;

  const employeesResult = await listEmployeesAction({ pageSize: 100 });
  const employees = employeesResult.ok
    ? employeesResult.data.rows.map((e) => ({ id: e.id, fullName: e.fullName }))
    : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref={`/risks/${riskId}`}
        title="Nova medida de controle"
        description={riskResult.data.description}
      />
      <RiskContext risk={riskResult.data} assessment={currentAssessment} />
      <ControlMeasureForm
        riskId={riskId}
        initial={{ applicable: false }}
        employees={employees}
        riskClassification={riskClassification}
      />
    </div>
  );
}
