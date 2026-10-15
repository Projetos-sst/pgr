import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getSignedCompanyLogoUrl } from "@/shared/integrations/storage/company-logo-storage";

import { PageHeader } from "../../../_ui/list";
import { CompanyForm } from "../../_components/company-form";
import { CompanyIcon } from "../../_components/company-icon";
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
  // `company.logoPath` já vem escopado pelo tenant (getCompanyAction ->
  // getCompanyById com withOrg) — seguro assinar direto, sem passar o path
  // pelo cliente antes.
  const logoUrl = company.logoPath
    ? await getSignedCompanyLogoUrl(company.logoPath).catch(() => null)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/companies"
        icon={<CompanyIcon />}
        title={company.razaoSocial}
        description="Detalhe e edição da empresa"
        action={<DeleteCompany id={company.id} redirectTo="/companies" variant="text" />}
      />
      <CompanyForm company={company} logoUrl={logoUrl} />
    </div>
  );
}
