import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEquipmentHeaderOptionsAction } from "@/shared/server/actions/inspections/equipment-inspections";

import { EmptyState, PageHeader } from "../../_ui/list";
import { HeaderForm } from "../_components/header-form";

export const dynamic = "force-dynamic";

export default async function NovaInspecaoEquipamentoPage() {
  await requireOfficeStaffPage();
  const optionsResult = await getEquipmentHeaderOptionsAction();
  const { equipment, plans } = optionsResult.ok
    ? optionsResult.data
    : { equipment: [], plans: [] };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/equipment-inspections"
        title="Nova inspeção de equipamento"
        description="Passo 1 de 2 — cabeçalho (equipamento e plano)."
      />
      {equipment.length === 0 || plans.length === 0 ? (
        <EmptyState
          message={
            equipment.length === 0
              ? "Cadastre um equipamento (máquina) no catálogo antes de inspecionar."
              : "Cadastre um plano de inspeção do tipo equipamento antes de inspecionar."
          }
        />
      ) : (
        <HeaderForm equipment={equipment} plans={plans} />
      )}
      <Link
        href="/equipment-inspections"
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
