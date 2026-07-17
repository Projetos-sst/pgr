import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { ServiceOrderStatus } from "@/shared/domains/safety/service-order";
import {
  getServiceOrderAction,
  listEmployeeOptionsAction,
} from "@/shared/server/actions/safety/service-orders";

import { PageHeader } from "../../../_ui/list";
import { ServiceOrderForm } from "../../_components/service-order-form";

export const dynamic = "force-dynamic";

export default async function EditServiceOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [result, employeesResult] = await Promise.all([
    getServiceOrderAction(id),
    listEmployeeOptionsAction(),
  ]);
  if (!result.ok) notFound();
  const { order, items } = result.data;
  const employees = employeesResult.ok ? employeesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Editar OS #${order.number}`}
        description="Atualize dados e checklist. Estados terminais não podem ser editados."
      />
      <ServiceOrderForm
        id={id}
        employees={employees}
        initial={{
          title: order.title,
          assignedEmployeeId: order.assignedEmployeeId,
          openedAt: order.openedAt,
          dueDate: order.dueDate,
          status: order.status as ServiceOrderStatus,
          items: items.map((i) => ({
            description: i.description,
            sourceType: i.sourceType as "manual" | "risk" | "epi",
            sourceId: i.sourceId,
          })),
        }}
      />
    </div>
  );
}
