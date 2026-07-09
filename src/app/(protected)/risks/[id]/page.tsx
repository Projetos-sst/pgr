import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import { getGesAction } from "@/shared/server/actions/pgr/ges";
import {
  riskAgentTypeLabel,
  exposureTimeLabel,
  measurementUnitLabel,
} from "@/shared/domains/pgr/risks";

import { PageHeader } from "../../_ui/list";
import { DeleteRisk } from "../_components/delete-risk";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs tracking-wide text-zinc-500 uppercase">{label}</span>
      <span className="text-sm">{value && value !== "" ? value : "—"}</span>
    </div>
  );
}

export default async function RiskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const riskResult = await getRiskAction(id);
  if (!riskResult.ok) notFound();
  const risk = riskResult.data;

  const gesResult = await getGesAction(risk.gesId);
  const gesName = gesResult.ok ? gesResult.data.ges.name : risk.gesId;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Risco"
        description={`GES: ${gesName}`}
        action={
          <div className="flex gap-2">
            <Link
              href={`/risks/new?from=${risk.id}`}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
            >
              Reutilizar
            </Link>
            <Link
              href={`/risks/${risk.id}/edit`}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
            >
              Editar
            </Link>
            <DeleteRisk id={risk.id} redirectTo="/risks" />
          </div>
        }
      />

      <section className="grid gap-4 rounded-lg border border-black/10 p-4 sm:grid-cols-3 dark:border-white/10">
        <Field label="GES" value={gesName} />
        <Field label="Grupo do agente" value={riskAgentTypeLabel(risk.agentType)} />
        <Field label="Perigo" value={risk.hazard} />
        <Field label="Descrição" value={risk.description} />
        <Field label="Fontes geradoras" value={risk.sources} />
        <Field label="Meios de propagação" value={risk.propagation} />
        <Field
          label="Tempo de exposição"
          value={risk.exposureTime ? exposureTimeLabel(risk.exposureTime) : null}
        />
        <Field label="Possíveis lesões" value={risk.possibleInjuries} />
        <Field label="Código do agente (S-2240)" value={risk.noxiousAgentCode} />
        <Field
          label="Unidade de medida"
          value={risk.measurementUnit ? measurementUnitLabel(risk.measurementUnit) : null}
        />
        <Field label="Concentração/intensidade" value={risk.concentrationIntensity} />
      </section>
    </div>
  );
}
