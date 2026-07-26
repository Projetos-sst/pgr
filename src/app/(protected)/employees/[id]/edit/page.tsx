import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEmployeeAction } from "@/shared/server/actions/pgr/employees";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../../_ui/list";
import { EmployeeForm } from "../../_components/employee-form";
import { EmployeeIcon } from "../../_components/employee-icon";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [employeeResult, companiesResult] = await Promise.all([
    getEmployeeAction(id),
    listCompanyOptionsAction(),
  ]);
  if (!employeeResult.ok) notFound();
  const companies = companiesResult.ok ? companiesResult.data : [];

  return (
    <div className="animate-fade-slide-up mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-5 py-7 sm:px-[30px] sm:pb-10">
      <PageHeader
        title="Editar funcionário"
        description={employeeResult.data.fullName}
        icon={<EmployeeIcon />}
        backHref={`/employees/${id}`}
        backLabel="Voltar para o funcionário"
      />
      <EmployeeForm companies={companies} employee={employeeResult.data} />
    </div>
  );
}
