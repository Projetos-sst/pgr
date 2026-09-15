import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  listIncidentOriginOptionsAction,
  listRiskOriginOptionsAction,
} from "@/shared/server/actions/safety/action-plans";

import { PageHeader } from "../../_ui/list";
import { ActionPlanForm } from "../_components/action-plan-form";

export const dynamic = "force-dynamic";

export default async function NewActionPlanPage() {
  await requireOfficeStaffPage();
  const [risksResult, incidentsResult] = await Promise.all([
    listRiskOriginOptionsAction(),
    listIncidentOriginOptionsAction(),
  ]);
  const riskOptions = risksResult.ok ? risksResult.data : [];
  const incidentOptions = incidentsResult.ok ? incidentsResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/action-plans"
        title="Novo plano de ação"
        description="Plano 5W2H vinculado a um risco ou incidente do escritório."
      />
      <ActionPlanForm
        riskOptions={riskOptions}
        incidentOptions={incidentOptions}
        initial={{
          type: null,
          what: "",
          why: "",
          who: "",
          where: "",
          when: null,
          how: "",
          howMuch: null,
          priority: null,
        }}
      />
    </div>
  );
}
