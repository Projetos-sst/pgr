import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { VehicleForm } from "../_components/vehicle-form";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  await requireOfficeStaffPage();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Novo veículo" />
      <VehicleForm />
    </div>
  );
}
