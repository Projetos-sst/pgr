import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listGesOptionsAction } from "@/shared/server/actions/pgr/ges";

import { PageHeader } from "../../../_ui/list";
import { RiskFactorForm } from "../_components/risk-factor-form";

export const dynamic = "force-dynamic";

export default async function NewRiskFactorPage() {
  await requireOfficeStaffPage();
  const gesResult = await listGesOptionsAction();
  const gesOptions = gesResult.ok ? gesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-[30px] pt-8 pb-10">
      <PageHeader
        title="Novo fator de risco"
        description="Cadastre um fator de risco psicossocial mapeado por GES (NR-01)."
        backHref="/psychosocial/risk-factors"
      />
      <RiskFactorForm gesOptions={gesOptions} />
    </div>
  );
}
