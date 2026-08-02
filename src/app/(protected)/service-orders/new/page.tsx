import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listEmployeeOptionsAction } from "@/shared/server/actions/safety/service-orders";
import { todayInSaoPaulo } from "@/shared/dates";

import { PageHeader } from "../../_ui/list";
import { ServiceOrderForm } from "../_components/service-order-form";
import { ServiceOrderIcon } from "../_components/service-order-icon";

export const dynamic = "force-dynamic";

export default async function NewServiceOrderPage() {
  await requireOfficeStaffPage();
  const employeesResult = await listEmployeeOptionsAction();
  const employees = employeesResult.ok ? employeesResult.data : [];

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/service-orders"
        icon={<ServiceOrderIcon />}
        title="Emitir Ordem de Serviço"
        description="O número é gerado automaticamente por escritório ao salvar."
      />
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
