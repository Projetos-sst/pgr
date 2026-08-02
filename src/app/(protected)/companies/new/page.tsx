import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { CompanyForm } from "../_components/company-form";
import { CompanyIcon } from "../_components/company-icon";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  await requireOfficeStaffPage();
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/companies"
        icon={<CompanyIcon />}
        title="Nova empresa"
        description="Empresa-cliente do escritório — raiz da cadeia do PGR"
      />
      <CompanyForm />
    </div>
  );
}
