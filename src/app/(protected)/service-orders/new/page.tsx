import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  listEmployeeOptionsAction,
  listWorkUnitOptionsAction,
} from "@/shared/server/actions/safety/service-orders";
import { todayInSaoPaulo } from "@/shared/dates";

import { PageHeader } from "../../_ui/list";
import { OnboardingTip } from "../../_components/onboarding-tip";
import { ServiceOrderForm } from "../_components/service-order-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ onboarding?: string; employeeId?: string }>;

export default async function NewServiceOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const [employeesResult, workUnitsResult, sp] = await Promise.all([
    listEmployeeOptionsAction(),
    listWorkUnitOptionsAction(),
    searchParams,
  ]);
  const employees = employeesResult.ok ? employeesResult.data : [];
  const workUnits = workUnitsResult.ok ? workUnitsResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Nova Ordem de Serviço"
        description="O número é gerado automaticamente por escritório ao salvar."
      />
      <OnboardingTip stepKey="serviceOrders" show={sp.onboarding === "1"} />
      <ServiceOrderForm
        employees={employees}
        workUnits={workUnits}
        initial={{
          title: "",
          osType: null,
          assignedEmployeeId: sp.employeeId ?? null,
          workUnitId: null,
          openedAt: todayInSaoPaulo(),
          dueDate: null,
          status: "open",
          items: [],
        }}
      />
    </div>
  );
}
