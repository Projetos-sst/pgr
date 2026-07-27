import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../../_ui/list";
import { CompanyForm } from "../../_components/company-form";
import { DeleteCompany } from "../../_components/delete-company";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getCompanyAction(id);
  if (!result.ok) notFound();
  const company = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={company.razaoSocial}
        description="Detalhe e edição da empresa."
        action={<DeleteCompany id={company.id} redirectTo="/companies" hasLabel />}
      />
      <CompanyForm company={company} />
    </div>
  );
}
