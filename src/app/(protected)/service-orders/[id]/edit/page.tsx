import { notFound, redirect } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { ServiceOrderStatus } from "@/shared/domains/safety/service-order";
import { isServiceOrderSigned } from "@/shared/domains/safety/service-order-signature";
import type { ExamType } from "@/shared/domains/pgr/health-exams";
import {
  getServiceOrderAction,
  listEmployeeOptionsAction,
  listWorkUnitOptionsAction,
} from "@/shared/server/actions/safety/service-orders";
import { getServiceOrderSignatureViewAction } from "@/shared/server/actions/safety/service-order-signature";

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
  const [result, employeesResult, workUnitsResult] = await Promise.all([
    getServiceOrderAction(id),
    listEmployeeOptionsAction(),
    listWorkUnitOptionsAction(),
  ]);
  if (!result.ok) notFound();
  const { order, items } = result.data;
  const employees = employeesResult.ok ? employeesResult.data : [];
  const workUnits = workUnitsResult.ok ? workUnitsResult.data : [];

  // OS assinada é imutável: a UI apenas antecipa o bloqueio que o repositório aplica de fato.
  const signatureResult = await getServiceOrderSignatureViewAction({
    serviceOrderId: id,
  });
  if (signatureResult.ok && isServiceOrderSigned(signatureResult.data.state)) {
    redirect(`/service-orders/${id}`);
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/service-orders"
        title={`Editar OS #${order.number}`}
        description="Atualize dados e checklist. Estados terminais não podem ser editados."
      />
      <ServiceOrderForm
        id={id}
        employees={employees}
        workUnits={workUnits}
        initial={{
          title: order.title,
          osType: (order.osType as ExamType | null) ?? null,
          assignedEmployeeId: order.assignedEmployeeId,
          workUnitId: order.workUnitId,
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
