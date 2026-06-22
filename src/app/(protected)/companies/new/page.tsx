import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { CompanyForm } from "../_components/company-form";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  await requireOfficeStaffPage();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Nova empresa" description="Cadastro de empresa-cliente." />
      <CompanyForm />
    </div>
  );
}
