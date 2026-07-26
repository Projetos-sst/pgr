import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { EmployeeForm } from "../_components/employee-form";
import { EmployeeIcon } from "../_components/employee-icon";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];
  return (
    <div className="animate-fade-slide-up mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-5 py-7 sm:px-[30px] sm:pb-10">
      <PageHeader
        title="Novo funcionário"
        description="Cadastro de colaborador vinculado a função e GES"
        icon={<EmployeeIcon />}
        backHref="/employees"
        backLabel="Voltar para funcionários"
      />
      <EmployeeForm companies={companies} />
    </div>
  );
}
