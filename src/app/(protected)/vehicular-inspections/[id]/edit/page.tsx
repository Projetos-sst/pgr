import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getVehicularHeaderOptionsAction,
  getVehicularInspectionAction,
} from "@/shared/server/actions/inspections/vehicular-inspections";

import { PageHeader } from "../../../_ui/list";
import { HeaderForm } from "../../_components/header-form";
import { VehicleIcon } from "../../_components/vehicle-icon";

export const dynamic = "force-dynamic";

export default async function EditarInspecaoVeicularPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getVehicularInspectionAction(id);
  if (!result.ok) notFound();
  const { inspection } = result.data;
  const optionsResult = await getVehicularHeaderOptionsAction();
  const { vehicles, plans } = optionsResult.ok
    ? optionsResult.data
    : { vehicles: [], plans: [] };

  return (
    <div className="animate-fade-slide-up mx-auto flex w-full max-w-[1320px] flex-col gap-[22px] px-5 py-8 sm:px-[30px]">
      <PageHeader
        title="Editar Cabeçalho da Inspeção"
        description="Veículo, plano e dados da rota."
        icon={<VehicleIcon />}
        backHref={`/vehicular-inspections/${id}`}
        backLabel="Voltar ao checklist"
      />
      <HeaderForm
        id={id}
        vehicles={vehicles}
        plans={plans}
        initial={{
          vehicleId: inspection.vehicleId,
          planId: inspection.planId,
          inspectedAt: inspection.inspectedAt,
          responsible: inspection.responsible,
          driverName: inspection.driverName,
          driverLicense: inspection.driverLicense,
          currentKm: inspection.currentKm,
          route: inspection.route,
          notes: inspection.notes,
        }}
      />
    </div>
  );
}
