import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getRiskMethodologyAction } from "@/shared/server/actions/pgr/risk-methodology";
import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";
import type { RiskMethodologyView } from "@/shared/domains/pgr/methodology";

import { PageHeader } from "../_ui/list";
import { MethodologyEditor } from "./_components/methodology-editor";

export const dynamic = "force-dynamic";

export default async function RiskMethodologyPage() {
  await requireOfficeStaffPage();
  const result = await getRiskMethodologyAction();
  const initial: RiskMethodologyView = result.ok
    ? result.data
    : { configured: false, ...defaultRiskMethodology() };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Metodologia de Avaliação de Riscos"
        description="Configure a matriz 5×5 (probabilidade × severidade) e as faixas de classificação do nível de risco da sua organização."
      />
      <MethodologyEditor initial={initial} />
    </div>
  );
}
