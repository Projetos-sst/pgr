import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getJobRoleAction } from "@/shared/server/actions/pgr/job-roles";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../../_ui/list";
import { JobRoleForm } from "../../_components/job-role-form";
import { DeleteJobRole } from "../../_components/delete-job-role";

export const dynamic = "force-dynamic";

export default async function EditJobRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [jobRoleResult, companiesResult] = await Promise.all([
    getJobRoleAction(id),
    listCompanyOptionsAction(),
  ]);
  if (!jobRoleResult.ok) notFound();
  const companies = companiesResult.ok ? companiesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={jobRoleResult.data.title}
        description="Detalhe e edição da função."
        action={<DeleteJobRole id={jobRoleResult.data.id} redirectTo="/job-roles" />}
      />
      <JobRoleForm companies={companies} jobRole={jobRoleResult.data} />
    </div>
  );
}
