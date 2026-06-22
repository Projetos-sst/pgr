import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { EmployeeForm } from "../_components/employee-form";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Novo funcionário"
        description="Empresa obrigatória; GES/função opcionais."
      />
      <EmployeeForm companies={companies} />
    </div>
  );
}
