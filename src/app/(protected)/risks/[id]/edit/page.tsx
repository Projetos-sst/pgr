import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import { getGesAction } from "@/shared/server/actions/pgr/ges";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../../_ui/list";
import { RiskForm, type RiskFormInitial } from "../../_components/risk-form";
import { DeleteRisk } from "../../_components/delete-risk";
import { EpiRiscoSection } from "../_components/epi-risco-section";

export const dynamic = "force-dynamic";

export default async function EditRiskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [riskResult, companyOptions] = await Promise.all([
    getRiskAction(id),
    listCompanyOptionsAction(),
  ]);
  if (!riskResult.ok) notFound();
  const risk = riskResult.data;
  const companies = companyOptions.ok ? companyOptions.data : [];

  const ges = await getGesAction(risk.gesId);
  const initial: RiskFormInitial = {
    companyId: ges.ok ? ges.data.ges.companyId : undefined,
    workUnitId: ges.ok ? ges.data.ges.workUnitId : undefined,
    gesId: risk.gesId,
    agentType: risk.agentType,
    hazard: risk.hazard,
    description: risk.description,
    sources: risk.sources,
    propagation: risk.propagation,
    exposureTime: risk.exposureTime,
    possibleInjuries: risk.possibleInjuries,
    noxiousAgentCode: risk.noxiousAgentCode,
    measurementUnit: risk.measurementUnit,
    concentrationIntensity: risk.concentrationIntensity,
  };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Editar risco"
        description="Detalhe e edição do risco do GES."
        action={<DeleteRisk id={risk.id} redirectTo="/risks" withLabel />}
      />
      <RiskForm companies={companies} riskId={risk.id} initial={initial} />
      <EpiRiscoSection riskId={risk.id} />
    </div>
  );
}
