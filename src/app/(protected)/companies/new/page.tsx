import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { OnboardingTip } from "../../_components/onboarding-tip";
import { CompanyForm } from "../_components/company-form";
import { CompanyIcon } from "../_components/company-icon";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ onboarding?: string }>;

export default async function NewCompanyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/companies"
        icon={<CompanyIcon />}
        title="Nova empresa"
        description="Empresa-cliente do escritório — raiz da cadeia do PGR"
      />
      <OnboardingTip stepKey="companies" show={sp.onboarding === "1"} />
      <CompanyForm />
    </div>
  );
}
