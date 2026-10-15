import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { inspectionStatusLabel } from "@/shared/domains/inspections/vehicular-inspections";
import { getVehicularInspectionAction } from "@/shared/server/actions/inspections/vehicular-inspections";

import { PageHeader } from "../../_ui/list";
import { StatusBadge, type StatusTone } from "../../_ui/status-badge";
import { ChecklistForm } from "../_components/checklist-form";
import { VehicleIcon } from "../_components/vehicle-icon";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, StatusTone> = {
  completed: "green",
  in_progress: "amber",
  pending: "neutral",
  cancelled: "red",
};

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-text-subtle font-mono text-[10px] tracking-[0.1em] uppercase">
        {label}
      </dt>
      <dd className="text-text mt-1 text-[13px] font-semibold">{children}</dd>
    </div>
  );
}

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
    <div className="animate-fade-slide-up mx-auto flex w-full max-w-[1320px] flex-col gap-[22px] px-5 py-8 sm:px-[30px]">
      <PageHeader
        title={`Checklist — ${vehicle?.plate ?? "veículo"}`}
        description="Passo 2 de 2 — responda item a item e conclua a inspeção."
        icon={<VehicleIcon />}
        backHref="/vehicular-inspections"
        backLabel="Voltar para inspeções veiculares"
        action={
          <Link
            href={`/vehicular-inspections/${id}/edit`}
            className="glass-input hover-lift text-text-muted hover:text-text rounded-card flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all sm:text-sm"
          >
            Editar cabeçalho
          </Link>
        }
      />

      <section className="glass-card rounded-[20px] p-5 sm:p-6">
        <h2 className="text-primary mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
          Cabeçalho da inspeção
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryItem label="Placa">
            <span className="text-primary font-mono">{vehicle?.plate ?? "—"}</span>
          </SummaryItem>
          <SummaryItem label="Plano">{plan?.title ?? "—"}</SummaryItem>
          <SummaryItem label="Data">
            <span className="tabular-nums">{formatIsoDate(inspection.inspectedAt)}</span>
          </SummaryItem>
          <SummaryItem label="Responsável">{inspection.responsible ?? "—"}</SummaryItem>
          <SummaryItem label="Status">
            <StatusBadge
              tone={STATUS_TONES[inspection.status] ?? "neutral"}
              label={inspectionStatusLabel(inspection.status)}
            />
          </SummaryItem>
        </dl>
      </section>

      <ChecklistForm inspectionId={id} items={items} />
    </div>
  );
}
