import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatPlate } from "@/shared/domains/inspections/vehicles";
import { getVehicleAction } from "@/shared/server/actions/inspections/vehicles";

import { FormPageHeader } from "../../../_ui/list";
import { VehicleForm } from "../../_components/vehicle-form";
import { VehicleIcon } from "../../_components/vehicle-icon";

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
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <FormPageHeader
        backHref="/vehicles"
        icon={<VehicleIcon />}
        title="Editar veículo"
        description={`Placa ${formatPlate(v.plate)}`}
      />
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
