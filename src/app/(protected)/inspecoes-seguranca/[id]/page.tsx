import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { inspectionCategoryLabel } from "@/shared/domains/inspections/safety-inspections";
import { inspectionStatusLabel } from "@/shared/domains/inspections/vehicular-inspections";
import { getSafetyInspectionAction } from "@/shared/server/actions/inspections/safety-inspections";

import { PageHeader } from "../../_ui/list";
import { InspectionSignaturePanel } from "../_components/signature-panel";
import { OccurrencesForm } from "../_components/occurrences-form";

export const dynamic = "force-dynamic";

export default async function InspecaoSegurancaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getSafetyInspectionAction(id);
  if (!result.ok) notFound();
  const { inspection, company, occurrences } = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Inspeção — ${inspectionCategoryLabel(inspection.category)}`}
        description={`${inspection.area ?? "área não informada"} · ${
          company?.razaoSocial ?? "sem empresa"
        } · ${inspection.inspectedAt} · ${inspectionStatusLabel(inspection.status)}`}
        action={
          <Link
            href={`/inspecoes-seguranca/${id}/edit`}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
          >
            Editar cabeçalho
          </Link>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-text text-lg font-semibold">Ocorrências</h2>
        <OccurrencesForm
          inspectionId={id}
          initial={occurrences.map((o) => ({
            description: o.description,
            severity: o.severity,
          }))}
        />
      </section>

      <InspectionSignaturePanel inspectionId={id} />

      <Link
        href="/inspecoes-seguranca"
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
