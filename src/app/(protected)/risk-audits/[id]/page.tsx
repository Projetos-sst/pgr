import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  originTypeLabel,
  riskAuditStatusLabel,
  type RiskAuditStatus,
} from "@/shared/domains/safety/risk-audit";
import { actionPlanStatusLabel } from "@/shared/domains/safety/action-plan";
import type { ActionPlanOriginType } from "@/shared/domains/safety/action-plan-origin";
import { getRiskAuditAction } from "@/shared/server/actions/safety/risk-audits";

import { PageHeader } from "../../_ui/list";
import { RiskAuditTransition } from "../_components/risk-audit-transition";
import { AuditPlanCreator } from "./_components/audit-plan-creator";

export const dynamic = "force-dynamic";

export default async function RiskAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getRiskAuditAction(id);
  if (!result.ok) notFound();

  const { audit, origin, plans } = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Auditoria — ${originTypeLabel(origin.type)}`}
        description={`Status: ${riskAuditStatusLabel(audit.status)}`}
        action={
          <Link
            href="/risk-audits"
            className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
          >
            ← Kanban
          </Link>
        }
      />

      <section className="glass-card flex flex-col gap-3 p-5">
        <div>
          <span className="text-text-muted text-sm font-semibold">Origem</span>
          <p className="text-text text-sm">
            {origin.removed ? (
              <span className="text-text-subtle italic">Origem removida</span>
            ) : (
              `${originTypeLabel(origin.type)}: ${origin.title ?? "—"}`
            )}
          </p>
        </div>
        {audit.justification ? (
          <div>
            <span className="text-text-muted text-sm font-semibold">
              Justificativa de conclusão
            </span>
            <p className="text-text text-sm">{audit.justification}</p>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-semibold">Alterar status</span>
          <RiskAuditTransition id={audit.id} current={audit.status as RiskAuditStatus} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text text-sm font-semibold">
          Planos de ação da origem ({plans.length})
        </h2>
        {plans.length === 0 ? (
          <p className="text-text-subtle text-sm">Nenhum plano vinculado à origem.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plans.map((p) => (
              <li
                key={p.id}
                className="glass-panel rounded-card flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <Link href={`/action-plans/${p.id}`} className="flex-1 hover:underline">
                  {p.what.length > 70 ? `${p.what.slice(0, 70)}…` : p.what}
                </Link>
                <span className="text-text-subtle">
                  {actionPlanStatusLabel(p.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {origin.removed ? (
        <p className="text-text-subtle text-sm">
          Não é possível criar planos: a origem foi removida.
        </p>
      ) : (
        <AuditPlanCreator
          originType={origin.type as ActionPlanOriginType}
          originId={audit.originId}
        />
      )}
    </div>
  );
}
