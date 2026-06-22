import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { WorkUnitForm } from "../_components/work-unit-form";

export const dynamic = "force-dynamic";

export default async function NewWorkUnitPage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Nova unidade de obra" description="Cadastro sob uma empresa." />
      <WorkUnitForm companies={companies} />
    </div>
  );
}
