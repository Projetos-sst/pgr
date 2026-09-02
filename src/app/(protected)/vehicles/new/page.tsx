import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  listVehicleCompanyOptionsAction,
  listVehicleInspectionPlanOptionsAction,
  listVehicleWorkUnitOptionsAction,
} from "@/shared/server/actions/inspections/vehicles";

import { PageHeader } from "../../_ui/list";
import { VehicleForm } from "../_components/vehicle-form";
import { VehicleIcon } from "../_components/vehicle-icon";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  await requireOfficeStaffPage();
  const [companiesRes, workUnitsRes, plansRes] = await Promise.all([
    listVehicleCompanyOptionsAction(),
    listVehicleWorkUnitOptionsAction(),
    listVehicleInspectionPlanOptionsAction(),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/vehicles"
        icon={<VehicleIcon />}
        title="Novo veículo"
        description="Frota para inspeções veiculares e ordens de serviço"
      />
      <VehicleForm
        companies={companiesRes.ok ? companiesRes.data : []}
        workUnits={workUnitsRes.ok ? workUnitsRes.data : []}
        inspectionPlans={plansRes.ok ? plansRes.data : []}
      />
    </div>
  );
}
