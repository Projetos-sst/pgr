import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getWorkUnitAction } from "@/shared/server/actions/pgr/work-units";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { FormPageHeader } from "../../../_ui/list";
import { WorkUnitForm } from "../../_components/work-unit-form";
import { WorkUnitIcon } from "../../_components/work-unit-icon";
import { DeleteWorkUnit } from "../../_components/delete-work-unit";

export const dynamic = "force-dynamic";

export default async function EditWorkUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [workUnitResult, companiesResult] = await Promise.all([
    getWorkUnitAction(id),
    listCompanyOptionsAction(),
  ]);
  if (!workUnitResult.ok) notFound();
  const companies = companiesResult.ok ? companiesResult.data : [];

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <FormPageHeader
        backHref="/work-units"
        icon={<WorkUnitIcon />}
        title={workUnitResult.data.name}
        description="Detalhe e edição da unidade de obra"
        action={
          <DeleteWorkUnit
            id={workUnitResult.data.id}
            redirectTo="/work-units"
            variant="text"
          />
        }
      />
      <WorkUnitForm companies={companies} workUnit={workUnitResult.data} />
    </div>
  );
}
