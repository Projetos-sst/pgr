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
import { DocumentAttachmentsSection } from "../../documents/_components/document-attachments-section";
import { ErgonomicEvaluationSection } from "./_components/ergonomic-evaluation-section";
import { riskShortLabel } from "./_components/risk-short-label";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-subtle text-xs tracking-wide uppercase">{label}</span>
      <span className="text-text text-sm">{value && value !== "" ? value : "—"}</span>
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
              href={`/risks/${risk.id}/assessments`}
              className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
            >
              Avaliações
            </Link>
            <Link
              href={`/risks/${risk.id}/ergonomic-evaluations`}
              className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
            >
              NR-17
            </Link>
            <Link
              href={`/risks/${risk.id}/control-measures`}
              className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
            >
              Medidas de controle
            </Link>
            <Link
              href={`/risks/new?from=${risk.id}`}
              className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
            >
              Reutilizar
            </Link>
            <Link
              href={`/risks/${risk.id}/edit`}
              className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
            >
              Editar
            </Link>
            <DeleteRisk id={risk.id} redirectTo="/risks" hasLabel />
          </div>
        }
      />

      <section className="glass-card grid gap-4 p-4 sm:grid-cols-3">
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

      <ErgonomicEvaluationSection
        riskId={risk.id}
        riskLabel={riskShortLabel(risk.description)}
      />

      <DocumentAttachmentsSection
        relatedEntityType="risk"
        relatedEntityId={risk.id}
        attachHref={
          `/documents/new?relatedEntityType=risk&relatedEntityId=${risk.id}` +
          `&returnTo=${encodeURIComponent(`/risks/${risk.id}`)}` +
          `&returnLabel=${encodeURIComponent(riskShortLabel(risk.description))}`
        }
        description="Documentos vinculados a este risco — laudos técnicos, evidências, ARTs."
      />
    </div>
  );
}
