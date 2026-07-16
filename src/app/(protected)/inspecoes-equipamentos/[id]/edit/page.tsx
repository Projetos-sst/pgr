import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getEquipmentHeaderOptionsAction,
  getEquipmentInspectionAction,
} from "@/shared/server/actions/inspections/equipment-inspections";

import { PageHeader } from "../../../_ui/list";
import { HeaderForm } from "../../_components/header-form";

export const dynamic = "force-dynamic";

export default async function EditarInspecaoEquipamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getEquipmentInspectionAction(id);
  if (!result.ok) notFound();
  const { inspection } = result.data;
  const optionsResult = await getEquipmentHeaderOptionsAction();
  const { equipment, plans } = optionsResult.ok
    ? optionsResult.data
    : { equipment: [], plans: [] };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Editar cabeçalho da inspeção" />
      <HeaderForm
        id={id}
        equipment={equipment}
        plans={plans}
        initial={{
          equipmentCatalogId: inspection.equipmentCatalogId,
          planId: inspection.planId,
          inspectedAt: inspection.inspectedAt,
          responsible: inspection.responsible,
          notes: inspection.notes,
        }}
      />
      <Link
        href={`/inspecoes-equipamentos/${id}`}
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar ao checklist
      </Link>
    </div>
  );
}
