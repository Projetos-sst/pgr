import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { OnboardingTip } from "../../_components/onboarding-tip";
import { GesForm } from "../_components/ges-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ onboarding?: string }>;

export default async function NewGesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const [result, sp] = await Promise.all([listCompanyOptionsAction(), searchParams]);
  const companies = result.ok ? result.data : [];
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Novo GES"
        description="Empresa → unidade de obra (cascata)."
        backHref="/ges"
      />
      <OnboardingTip stepKey="ges" show={sp.onboarding === "1"} />
      <GesForm companies={companies} />
    </div>
  );
}
