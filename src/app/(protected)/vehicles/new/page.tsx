import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { VehicleForm } from "../_components/vehicle-form";
import { VehicleIcon } from "../_components/vehicle-icon";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  await requireOfficeStaffPage();
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/vehicles"
        icon={<VehicleIcon />}
        title="Novo veículo"
        description="Frota para inspeções veiculares e ordens de serviço"
      />
      <VehicleForm />
    </div>
  );
}
