import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getRiskMethodologyAction } from "@/shared/server/actions/pgr/risk-methodology";
import { defaultRiskMethodology } from "@/shared/domains/pgr/methodology-presets";
import type { RiskMethodologyView } from "@/shared/domains/pgr/methodology";

import { PageHeader } from "../_ui/list";
import { MethodologyEditor } from "./_components/methodology-editor";
import { MethodologyIcon } from "./_components/methodology-icon";

export const dynamic = "force-dynamic";

export default async function RiskMethodologyPage() {
  await requireOfficeStaffPage();
  const result = await getRiskMethodologyAction();
  const initial: RiskMethodologyView = result.ok
    ? result.data
    : { configured: false, ...defaultRiskMethodology() };

  return (
    /*
     * Largura híbrida (1120px): as telas de formulário do sistema usam 940px,
     * mas aqui a matriz 5×5 precisa de ~940px só para as cinco colunas mais o
     * cabeçalho de linha. Um eixo único para todos os cartões — nada de o
     * formulário ficar estreito e a matriz vazar para fora dele.
     */
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-[22px] px-5 pt-7 pb-10 sm:px-[30px]">
      <PageHeader
        icon={<MethodologyIcon />}
        title="Metodologia de Avaliação de Riscos"
        description="Configure a matriz 5×5 (probabilidade × severidade) e as faixas de classificação do nível de risco da sua organização."
      />
      <MethodologyEditor initial={initial} />
    </div>
  );
}
