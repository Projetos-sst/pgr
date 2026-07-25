import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { FormPageHeader } from "../../_ui/list";
import { JobRoleForm } from "../_components/job-role-form";
import { JobRoleIcon } from "../_components/job-role-icon";

export const dynamic = "force-dynamic";

export default async function NewJobRolePage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <FormPageHeader
        backHref="/job-roles"
        icon={<JobRoleIcon />}
        title="Nova função"
        description="Cargo ocupacional sob uma empresa"
      />
      <JobRoleForm companies={companies} />
    </div>
  );
}
