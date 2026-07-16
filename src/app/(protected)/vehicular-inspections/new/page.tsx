import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getVehicularHeaderOptionsAction } from "@/shared/server/actions/inspections/vehicular-inspections";

import { EmptyState, PageHeader } from "../../_ui/list";
import { HeaderForm } from "../_components/header-form";

export const dynamic = "force-dynamic";

export default async function NovaInspecaoVeicularPage() {
  await requireOfficeStaffPage();
  const optionsResult = await getVehicularHeaderOptionsAction();
  const { vehicles, plans } = optionsResult.ok
    ? optionsResult.data
    : { vehicles: [], plans: [] };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Nova inspeção veicular"
        description="Passo 1 de 2 — cabeçalho (veículo, plano e dados da rota)."
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
      <Link
        href="/vehicular-inspections"
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
