import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { WorkUnitForm } from "../_components/work-unit-form";
import { WorkUnitIcon } from "../_components/work-unit-icon";

export const dynamic = "force-dynamic";

export default async function NewWorkUnitPage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/work-units"
        icon={<WorkUnitIcon />}
        title="Nova unidade de obra"
        description="Canteiro, filial ou local sob uma empresa"
      />
      <WorkUnitForm companies={companies} />
    </div>
  );
}
