import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listEmployeeOptionsAction } from "@/shared/server/actions/safety/service-orders";
import { todayInSaoPaulo } from "@/shared/dates";

import { PageHeader } from "../../_ui/list";
import { OnboardingTip } from "../../_components/onboarding-tip";
import { ServiceOrderForm } from "../_components/service-order-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ onboarding?: string }>;

export default async function NewServiceOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const [employeesResult, sp] = await Promise.all([
    listEmployeeOptionsAction(),
    searchParams,
  ]);
  const employees = employeesResult.ok ? employeesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Nova Ordem de Serviço"
        description="O número é gerado automaticamente por escritório ao salvar."
      />
      <OnboardingTip stepKey="serviceOrders" show={sp.onboarding === "1"} />
      <ServiceOrderForm
        employees={employees}
        initial={{
          title: "",
          assignedEmployeeId: null,
          openedAt: todayInSaoPaulo(),
          dueDate: null,
          status: "open",
          items: [],
        }}
      />
    </div>
  );
}
