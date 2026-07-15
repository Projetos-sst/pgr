import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { inspectionStatusLabel } from "@/shared/domains/inspections/vehicular-inspections";
import { getVehicularInspectionAction } from "@/shared/server/actions/inspections/vehicular-inspections";

import { PageHeader } from "../../_ui/list";
import { ChecklistForm } from "../_components/checklist-form";

export const dynamic = "force-dynamic";

export default async function InspecaoVeicularChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getVehicularInspectionAction(id);
  if (!result.ok) notFound();
  const { inspection, vehicle, plan, items } = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Checklist — ${vehicle?.plate ?? "veículo"}`}
        description={`Passo 2 de 2 · Plano: ${plan?.title ?? "—"} · ${
          inspection.inspectedAt
        } · ${inspectionStatusLabel(inspection.status)}`}
        action={
          <Link
            href={`/inspecoes-veiculares/${id}/edit`}
            className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
          >
            Editar cabeçalho
          </Link>
        }
      />
      <ChecklistForm inspectionId={id} items={items} />
      <Link
        href="/inspecoes-veiculares"
        className="text-sm text-zinc-500 hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
