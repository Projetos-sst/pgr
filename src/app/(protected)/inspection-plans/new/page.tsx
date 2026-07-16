import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { PlanForm } from "../_components/plan-form";

export const dynamic = "force-dynamic";

export default async function NovoPlanoPage() {
  await requireOfficeStaffPage();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Novo plano de inspeção" />
      <PlanForm />
    </div>
  );
}
