import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  RISK_AUDIT_STATUSES,
  RISK_AUDIT_STATUS_LABELS,
  originTypeLabel,
  type RiskAuditListItem,
  type RiskAuditStatus,
} from "@/shared/domains/safety/risk-audit";
import {
  listRiskAuditIncidentOptionsAction,
  listRiskAuditRiskOptionsAction,
  listRiskAuditsAction,
} from "@/shared/server/actions/safety/risk-audits";

import { PageHeader } from "../_ui/list";
import { CreateRiskAudit } from "./_components/create-risk-audit";
import { RiskAuditTransition } from "./_components/risk-audit-transition";

export const dynamic = "force-dynamic";

function AuditCard({ audit }: { audit: RiskAuditListItem }) {
  return (
    <div className="glass-panel rounded-card flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-text-subtle font-mono text-[10px] uppercase">
          {originTypeLabel(audit.origin.type)}
        </span>
        <span className="rounded-pill bg-primary-ring text-primary-strong px-2 py-0.5 text-[10px] font-semibold">
          {audit.planCount} plano(s)
        </span>
      </div>
      <Link
        href={`/risk-audits/${audit.id}`}
        className="text-text text-sm font-medium hover:underline"
      >
        {audit.origin.removed ? (
          <span className="text-text-subtle italic">Origem removida</span>
        ) : (
          (audit.origin.title ?? "—")
        )}
      </Link>
      <div className="text-text-subtle flex flex-col gap-0.5 text-[11px]">
        <span>Criada: {audit.createdAt.slice(0, 10)}</span>
        {audit.startedAt ? <span>Iniciada: {audit.startedAt.slice(0, 10)}</span> : null}
        {audit.completedAt ? (
          <span>Concluída: {audit.completedAt.slice(0, 10)}</span>
        ) : null}
      </div>
      <RiskAuditTransition id={audit.id} current={audit.status as RiskAuditStatus} />
    </div>
  );
}

export default async function RiskAuditsPage() {
  await requireOfficeStaffPage();
  const [auditsResult, riskOptionsResult, incidentOptionsResult] = await Promise.all([
    listRiskAuditsAction({ pageSize: 100 }),
    listRiskAuditRiskOptionsAction(),
    listRiskAuditIncidentOptionsAction(),
  ]);

  const audits = auditsResult.ok ? auditsResult.data.rows : [];
  const riskOptions = riskOptionsResult.ok ? riskOptionsResult.data : [];
  const incidentOptions = incidentOptionsResult.ok ? incidentOptionsResult.data : [];

  const byStatus = (status: RiskAuditStatus) => audits.filter((a) => a.status === status);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Auditorias de Risco"
        description="Kanban de análise por origem (risco ou incidente). Transições são sempre explícitas."
      />

      <CreateRiskAudit riskOptions={riskOptions} incidentOptions={incidentOptions} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {RISK_AUDIT_STATUSES.map((status) => {
          const column = byStatus(status);
          return (
            <section key={status} className="flex flex-col gap-3">
              <h2 className="text-text-muted text-sm font-semibold">
                {RISK_AUDIT_STATUS_LABELS[status]}{" "}
                <span className="text-text-subtle">({column.length})</span>
              </h2>
              <div className="flex flex-col gap-3">
                {column.length === 0 ? (
                  <p className="glass-card text-text-subtle rounded-card px-4 py-6 text-center text-xs">
                    Nenhuma auditoria.
                  </p>
                ) : (
                  column.map((audit) => <AuditCard key={audit.id} audit={audit} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
