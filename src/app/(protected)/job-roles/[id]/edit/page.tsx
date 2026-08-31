import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getJobRoleAction } from "@/shared/server/actions/pgr/job-roles";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import { listGesOptionsAction } from "@/shared/server/actions/pgr/ges";
import { listRequiredTrainingsAction } from "@/shared/server/actions/pgr/job-role-required-trainings";
import { listTrainingCatalogOptionsAction } from "@/shared/server/actions/pgr/training-catalog";

import { PageHeader } from "../../../_ui/list";
import { JobRoleForm } from "../../_components/job-role-form";
import { JobRoleIcon } from "../../_components/job-role-icon";
import { DeleteJobRole } from "../../_components/delete-job-role";
import { RequiredTrainings } from "../../_components/required-trainings";

export const dynamic = "force-dynamic";

export default async function EditJobRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [
    jobRoleResult,
    companiesResult,
    gesResult,
    requiredResult,
    trainingOptionsResult,
  ] = await Promise.all([
    getJobRoleAction(id),
    listCompanyOptionsAction(),
    listGesOptionsAction(),
    listRequiredTrainingsAction({ jobRoleId: id }),
    listTrainingCatalogOptionsAction(),
  ]);
  if (!jobRoleResult.ok) notFound();
  const companies = companiesResult.ok ? companiesResult.data : [];
  const gesOptions = gesResult.ok ? gesResult.data : [];
  const requiredTrainings = requiredResult.ok ? requiredResult.data : [];
  const trainingOptions = trainingOptionsResult.ok ? trainingOptionsResult.data : [];

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/job-roles"
        icon={<JobRoleIcon />}
        title={jobRoleResult.data.title}
        description="Detalhe e edição da função"
        action={
          <DeleteJobRole
            id={jobRoleResult.data.id}
            redirectTo="/job-roles"
            variant="text"
          />
        }
      />
      <JobRoleForm
        companies={companies}
        gesOptions={gesOptions}
        jobRole={jobRoleResult.data}
      />
      <RequiredTrainings
        jobRoleId={jobRoleResult.data.id}
        links={requiredTrainings}
        options={trainingOptions}
      />
    </div>
  );
}
