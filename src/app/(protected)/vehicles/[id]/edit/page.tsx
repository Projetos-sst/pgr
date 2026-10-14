import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatPlate } from "@/shared/domains/inspections/vehicles";
import {
  getVehicleAction,
  getVehiclePhotoUrlAction,
  listVehicleCompanyOptionsAction,
  listVehicleInspectionPlanOptionsAction,
  listVehicleWorkUnitOptionsAction,
} from "@/shared/server/actions/inspections/vehicles";

import { PageHeader } from "../../../_ui/list";
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
  const [result, companiesRes, workUnitsRes, plansRes] = await Promise.all([
    getVehicleAction(id),
    listVehicleCompanyOptionsAction(),
    listVehicleWorkUnitOptionsAction(),
    listVehicleInspectionPlanOptionsAction(),
  ]);
  if (!result.ok) notFound();
  const v = result.data;
  const photoResult = v.photoPath
    ? await getVehiclePhotoUrlAction(id).catch(() => null)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/vehicles"
        icon={<VehicleIcon />}
        title="Editar veículo"
        description={`Placa ${formatPlate(v.plate)}`}
      />
      <VehicleForm
        id={v.id}
        photoUrl={photoResult?.ok ? photoResult.data.url : null}
        companies={companiesRes.ok ? companiesRes.data : []}
        workUnits={workUnitsRes.ok ? workUnitsRes.data : []}
        inspectionPlans={plansRes.ok ? plansRes.data : []}
        initial={{
          plate: v.plate,
          renavam: v.renavam,
          brand: v.brand,
          model: v.model,
          type: v.type,
          year: v.year,
          color: v.color,
          owner: v.owner,
          companyId: v.companyId,
          workUnitId: v.workUnitId,
          inspectionPlanId: v.inspectionPlanId,
          inspectionFrequency: v.inspectionFrequency,
          initialKm: v.initialKm,
          notes: v.notes,
          photoPath: v.photoPath,
        }}
      />
    </div>
  );
}
