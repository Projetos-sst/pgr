import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getVehicularHeaderOptionsAction } from "@/shared/server/actions/inspections/vehicular-inspections";

import { EmptyState, PageHeader } from "../../_ui/list";
import { HeaderForm } from "../_components/header-form";
import { VehicleIcon } from "../_components/vehicle-icon";

export const dynamic = "force-dynamic";

export default async function NovaInspecaoVeicularPage() {
  await requireOfficeStaffPage();
  const optionsResult = await getVehicularHeaderOptionsAction();
  const { vehicles, plans } = optionsResult.ok
    ? optionsResult.data
    : { vehicles: [], plans: [] };

  return (
    <div className="animate-fade-slide-up mx-auto flex w-full max-w-[1320px] flex-col gap-[22px] px-5 py-8 sm:px-[30px]">
      <PageHeader
        title="Nova Inspeção Veicular"
        description="Passo 1 de 2 — cabeçalho (veículo, plano e dados da rota)."
        icon={<VehicleIcon />}
        backHref="/vehicular-inspections"
        backLabel="Voltar para inspeções veiculares"
      />
      {vehicles.length === 0 || plans.length === 0 ? (
        <EmptyState
          message={
            vehicles.length === 0
              ? "Cadastre ao menos um veículo antes de inspecionar."
              : "Cadastre um plano de inspeção do tipo veicular antes de inspecionar."
          }
        />
      ) : (
        <HeaderForm vehicles={vehicles} plans={plans} />
      )}
    </div>
  );
}
