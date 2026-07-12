import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import { getCurrentRiskAssessmentAction } from "@/shared/server/actions/pgr/risk-assessments";
import { getControlMeasureAction } from "@/shared/server/actions/pgr/control-measures";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";

import { PageHeader } from "../../../../../_ui/list";
import { ControlMeasureForm } from "../../_components/control-measure-form";
import { RiskContext } from "../../_components/risk-context";

export const dynamic = "force-dynamic";

export default async function EditControlMeasurePage({
  params,
}: {
  params: Promise<{ id: string; measureId: string }>;
}) {
  await requireOfficeStaffPage();
  const { id: riskId, measureId } = await params;

  const measureResult = await getControlMeasureAction(measureId);
  if (!measureResult.ok) notFound();
  const measure = measureResult.data;

  const riskResult = await getRiskAction(riskId);
  if (!riskResult.ok) notFound();

  const assessmentResult = await getCurrentRiskAssessmentAction(riskId);
  const currentAssessment = assessmentResult.ok ? assessmentResult.data : null;

  const employeesResult = await listEmployeesAction({ pageSize: 100 });
  const employees = employeesResult.ok
    ? employeesResult.data.rows.map((e) => ({ id: e.id, fullName: e.fullName }))
    : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Editar medida de controle"
        description={riskResult.data.description}
      />
      <RiskContext risk={riskResult.data} assessment={currentAssessment} />
      <ControlMeasureForm
        riskId={riskId}
        measureId={measure.id}
        lockLevel
        employees={employees}
        initial={{
          controlLevel: measure.controlLevel,
          applicable: measure.applicable,
          justification: measure.justification,
          monitoring: measure.monitoring,
          actionWhat: measure.actionWhat,
          actionHow: measure.actionHow,
          actionTracking: measure.actionTracking,
          actionMeasurement: measure.actionMeasurement,
          actionResponsible: measure.actionResponsible,
          actionDeadline: measure.actionDeadline,
        }}
      />
    </div>
  );
}
