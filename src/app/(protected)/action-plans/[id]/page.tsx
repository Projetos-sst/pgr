import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  actionPlanPriorityLabel,
  actionPlanStatusLabel,
  isActionPlanTerminal,
  type ActionPlanStatus,
} from "@/shared/domains/safety/action-plan";
import { originTypeLabel } from "@/shared/domains/safety/action-plan-origin";
import { getActionPlanAction } from "@/shared/server/actions/safety/action-plans";

import { PageHeader } from "../../_ui/list";
import { ActionPlanStatusActions } from "../_components/action-plan-status-actions";
import { DeleteActionPlan } from "../_components/delete-action-plan";

export const dynamic = "force-dynamic";

type Field = { label: string; value: string };

function Field({ label, value }: Field) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-subtle text-xs font-semibold tracking-wide uppercase">
        {label}
      </span>
      <span className="text-text whitespace-pre-wrap">{value}</span>
    </div>
  );
}

export default async function ActionPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getActionPlanAction(id);
  if (!result.ok) notFound();
  const { plan, overdue, origin } = result.data;
  const terminal = isActionPlanTerminal(plan.status);

  const originHref = origin.removed
    ? null
    : origin.type === "risk"
      ? `/risks/${origin.id}`
      : `/incidents/${origin.id}`;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={plan.what.length > 80 ? `${plan.what.slice(0, 80)}…` : plan.what}
        description={`${actionPlanStatusLabel(plan.status)} · Prioridade ${actionPlanPriorityLabel(plan.priority)}${overdue ? " · Atrasado" : ""}`}
        action={
          <div className="flex gap-2">
            {terminal ? null : (
              <Link
                href={`/action-plans/${id}/edit`}
                className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
              >
                Editar
              </Link>
            )}
            <DeleteActionPlan id={id} redirectTo="/action-plans" withLabel />
          </div>
        }
      />

      <section className="glass-card flex flex-col gap-2 p-5 text-sm">
        <span className="text-text-subtle text-xs font-semibold tracking-wide uppercase">
          Origem
        </span>
        {origin.removed ? (
          <span className="text-text-subtle italic">Origem removida</span>
        ) : originHref ? (
          <Link
            href={originHref}
            className="text-primary-strong font-medium hover:underline"
          >
            {originTypeLabel(origin.type)}: {origin.title}
          </Link>
        ) : (
          <span className="text-text">
            {originTypeLabel(origin.type)}: {origin.title}
          </span>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-text text-sm font-semibold">Alterar status</h2>
        <ActionPlanStatusActions id={id} current={plan.status as ActionPlanStatus} />
      </section>

      <div className="glass-card grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2">
        <Field label="O quê" value={plan.what} />
        <Field label="Por quê" value={plan.why} />
        <Field label="Quem" value={plan.who} />
        <Field label="Onde" value={plan.where} />
        <Field label="Como" value={plan.how} />
        <Field label="Quando (prazo)" value={plan.when ?? "—"} />
        <Field
          label="Quanto custa"
          value={plan.howMuch != null ? `R$ ${plan.howMuch}` : "—"}
        />
        <Field label="Prioridade" value={actionPlanPriorityLabel(plan.priority)} />
        {plan.completedAt ? (
          <Field
            label="Concluído em"
            value={new Date(plan.completedAt).toLocaleString("pt-BR")}
          />
        ) : null}
        {plan.cancelledAt ? (
          <Field
            label="Cancelado em"
            value={new Date(plan.cancelledAt).toLocaleString("pt-BR")}
          />
        ) : null}
      </div>
    </div>
  );
}
