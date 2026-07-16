import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getVehicularHeaderOptionsAction,
  getVehicularInspectionAction,
} from "@/shared/server/actions/inspections/vehicular-inspections";

import { PageHeader } from "../../../_ui/list";
import { HeaderForm } from "../../_components/header-form";

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
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Editar cabeçalho da inspeção" />
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
      <Link
        href={`/inspecoes-veiculares/${id}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← Voltar ao checklist
      </Link>
    </div>
  );
}
