import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEmployeeAction } from "@/shared/server/actions/pgr/employees";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../../_ui/list";
import { EmployeeForm } from "../../_components/employee-form";

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
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title={`Editar — ${employeeResult.data.fullName}`} />
      <EmployeeForm companies={companies} employee={employeeResult.data} />
    </div>
  );
}
