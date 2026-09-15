import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listGesOptionsAction } from "@/shared/server/actions/pgr/ges";
import { getPsychosocialRiskFactorAction } from "@/shared/server/actions/psychosocial/risk-factors";

import { PageHeader } from "../../../../_ui/list";
import { RiskFactorForm } from "../../_components/risk-factor-form";
import { DeleteRiskFactor } from "../../_components/delete-risk-factor";

export const dynamic = "force-dynamic";

export default async function EditRiskFactorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [result, gesResult] = await Promise.all([
    getPsychosocialRiskFactorAction(id),
    listGesOptionsAction(),
  ]);
  if (!result.ok) notFound();
  const gesOptions = gesResult.ok ? gesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-[30px] pt-8 pb-10">
      <PageHeader
        title="Editar fator de risco"
        description="Altere o fator de risco psicossocial ou exclua-o do catálogo."
        backHref="/psychosocial/risk-factors"
        action={
          <DeleteRiskFactor
            id={result.data.id}
            redirectTo="/psychosocial/risk-factors"
            hasLabel
          />
        }
      />
      <RiskFactorForm factor={result.data} gesOptions={gesOptions} />
    </div>
  );
}
