import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { JobRoleForm } from "../_components/job-role-form";

export const dynamic = "force-dynamic";

export default async function NewJobRolePage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Nova função" description="Cargo ocupacional sob uma empresa." />
      <JobRoleForm companies={companies} />
    </div>
  );
}
