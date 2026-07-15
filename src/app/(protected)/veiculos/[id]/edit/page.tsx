import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getVehicleAction } from "@/shared/server/actions/inspections/vehicles";

import { PageHeader } from "../../../_ui/list";
import { VehicleForm } from "../../_components/vehicle-form";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getVehicleAction(id);
  if (!result.ok) notFound();
  const v = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Editar veículo" />
      <VehicleForm
        id={v.id}
        initial={{
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          type: v.type,
          color: v.color,
          owner: v.owner,
          initialKm: v.initialKm,
          notes: v.notes,
        }}
      />
    </div>
  );
}
