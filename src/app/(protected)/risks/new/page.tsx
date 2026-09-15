import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import { getGesAction } from "@/shared/server/actions/pgr/ges";
import type { Risk } from "@/shared/domains/pgr/risk";

import { PageHeader } from "../../_ui/list";
import { OnboardingTip } from "../../_components/onboarding-tip";
import { RiskForm, type RiskFormInitial } from "../_components/risk-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ from?: string; onboarding?: string }>;

/**
 * Reutilização por prefill: com `?from=<id>`, lê o risco de origem (mesmo tenant) e o
 * GES para preencher a cascata Empresa→Obra→GES; a criação gera um novo `id`.
 */
async function buildPrefill(fromId: string): Promise<RiskFormInitial | undefined> {
  const source = await getRiskAction(fromId);
  if (!source.ok) return undefined;
  const risk: Risk = source.data;
  const ges = await getGesAction(risk.gesId);
  return {
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
}

export default async function NewRiskPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const [companyOptions, initial] = await Promise.all([
    listCompanyOptionsAction(),
    sp.from ? buildPrefill(sp.from) : Promise.resolve(undefined),
  ]);
  const companies = companyOptions.ok ? companyOptions.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/risks"
        title="Novo risco"
        description={
          initial
            ? "Reutilizando um risco existente — ajuste o GES de destino e os campos conforme necessário."
            : "Cadastro de risco de um Grupo de Exposição Similar (NR-01/GRO / eSocial S-2240)."
        }
      />
      <OnboardingTip stepKey="risks" show={sp.onboarding === "1"} />
      <RiskForm companies={companies} initial={initial} />
    </div>
  );
}
