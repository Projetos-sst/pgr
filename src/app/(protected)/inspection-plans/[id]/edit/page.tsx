import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getPlanAction } from "@/shared/server/actions/inspections/plans";

import { PageHeader } from "../../../_ui/list";
import { PlanForm } from "../../_components/plan-form";

export const dynamic = "force-dynamic";

export default async function EditarPlanoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getPlanAction(id);
  if (!result.ok) notFound();
  const { plan, items } = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Editar plano de inspeção" />
      <PlanForm
        id={plan.id}
        initial={{
          type: plan.type,
          subtype: plan.subtype,
          title: plan.title,
          description: plan.description,
          frequency: plan.frequency,
          status: plan.status,
          items: items.map((it) => ({
            description: it.description,
            defaultValue: it.defaultValue,
          })),
        }}
      />
    </div>
  );
}
