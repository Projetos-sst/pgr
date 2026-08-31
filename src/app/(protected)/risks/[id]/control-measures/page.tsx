import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listControlMeasuresAction } from "@/shared/server/actions/pgr/control-measures";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import { getCurrentRiskAssessmentAction } from "@/shared/server/actions/pgr/risk-assessments";
import {
  controlLevelLabel,
  deriveMeasureState,
} from "@/shared/domains/pgr/control-measure";

import { EmptyState, PageHeader, PrimaryLink, Table } from "../../../_ui/list";
import { EditRowAction, RowActions } from "../../../_ui/row-actions";
import { DeleteControlMeasure } from "./_components/delete-control-measure";
import { MeasureStateBadge } from "./_components/measure-state-badge";
import { MeasureStatusBadge } from "./_components/measure-status-badge";
import { RiskContext } from "./_components/risk-context";

export const dynamic = "force-dynamic";

/** Data local do negócio (America/Sao_Paulo) em AAAA-MM-DD, para o estado derivado. */
function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
}

export default async function ControlMeasuresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id: riskId } = await params;
  const { page } = resolvePageParams({});

  const riskResult = await getRiskAction(riskId);
  if (!riskResult.ok) notFound();

  const assessmentResult = await getCurrentRiskAssessmentAction(riskId);
  const currentAssessment = assessmentResult.ok ? assessmentResult.data : null;

  const listResult = await listControlMeasuresAction(riskId, { page });
  const rows = listResult.ok ? listResult.data.rows : [];
  const today = todaySaoPaulo();

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Medidas de controle"
        description={riskResult.data.description}
        action={
          <div className="flex gap-2">
            <Link
              href={`/risks/${riskId}`}
              className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
            >
              Voltar ao risco
            </Link>
            <PrimaryLink href={`/risks/${riskId}/control-measures/new`}>
              Nova medida
            </PrimaryLink>
          </div>
        }
      />

      <RiskContext risk={riskResult.data} assessment={currentAssessment} />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma medida de controle registrada. Crie a primeira medida por nível NR-01." />
      ) : (
        <Table headers={["Nível NR-01", "Estado", "Status", "Responsável", "Prazo", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 font-medium">
                {controlLevelLabel(row.controlLevel)}
              </td>
              <td className="px-4 py-2">
                <MeasureStateBadge state={deriveMeasureState(row, today)} />
              </td>
              <td className="px-4 py-2">
                <MeasureStatusBadge status={row.status} />
              </td>
              <td className="px-4 py-2">{row.actionResponsible ?? "—"}</td>
              <td className="px-4 py-2">{row.actionDeadline ?? "—"}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <EditRowAction
                    href={`/risks/${riskId}/control-measures/${row.id}/edit`}
                  />
                  <DeleteControlMeasure riskId={riskId} id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
