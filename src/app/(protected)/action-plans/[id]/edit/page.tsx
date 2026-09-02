import { notFound, redirect } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { isActionPlanTerminal } from "@/shared/domains/safety/action-plan";
import { originTypeLabel } from "@/shared/domains/safety/action-plan-origin";
import { getActionPlanAction } from "@/shared/server/actions/safety/action-plans";

import { PageHeader } from "../../../_ui/list";
import { ActionPlanForm } from "../../_components/action-plan-form";

export const dynamic = "force-dynamic";

export default async function EditActionPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getActionPlanAction(id);
  if (!result.ok) notFound();
  const { plan, origin } = result.data;

  // Plano terminal é imutável: o repositório rejeita a edição; a UI antecipa.
  if (isActionPlanTerminal(plan.status)) redirect(`/action-plans/${id}`);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Editar plano de ação"
        description="A origem é imutável. Planos terminais não podem ser editados."
      />
      <ActionPlanForm
        id={id}
        fixedOrigin={
          origin.removed
            ? null
            : { typeLabel: originTypeLabel(origin.type), label: origin.title ?? "—" }
        }
        riskOptions={[]}
        incidentOptions={[]}
        initial={{
          type: plan.type,
          what: plan.what,
          why: plan.why,
          who: plan.who,
          where: plan.where,
          when: plan.when,
          how: plan.how,
          howMuch: plan.howMuch,
          priority: plan.priority,
        }}
      />
    </div>
  );
}
