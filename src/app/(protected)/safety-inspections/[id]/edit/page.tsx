import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getSafetyInspectionAction,
  listSafetyCompanyOptionsAction,
} from "@/shared/server/actions/inspections/safety-inspections";

import { PageHeader } from "../../../_ui/list";
import { HeaderForm } from "../../_components/header-form";

export const dynamic = "force-dynamic";

export default async function EditarInspecaoSegurancaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getSafetyInspectionAction(id);
  if (!result.ok) notFound();
  const { inspection } = result.data;
  const companiesResult = await listSafetyCompanyOptionsAction();
  const companies = companiesResult.ok ? companiesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Editar cabeçalho da inspeção" />
      <HeaderForm
        id={id}
        companies={companies}
        initial={{
          category: inspection.category ?? "safety",
          inspectedAt: inspection.inspectedAt,
          planned: inspection.planned ?? false,
          area: inspection.area,
          companyId: inspection.companyId,
          responsible: inspection.responsible,
          notes: inspection.notes,
        }}
      />
      <Link
        href={`/safety-inspections/${id}`}
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
