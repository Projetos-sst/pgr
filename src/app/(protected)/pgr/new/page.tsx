import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { OnboardingTip } from "../../_components/onboarding-tip";
import { PgrForm } from "../_components/pgr-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ onboarding?: string }>;

export default async function NewPgrPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const [result, sp] = await Promise.all([listCompanyOptionsAction("pgr"), searchParams]);
  const companies = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/pgr"
        title="Novo PGR"
        description="Documento de Gerenciamento de Riscos Ocupacionais (NR-01/GRO). A criação exige o aceite da Declaração de Ciência de Riscos."
      />
      <OnboardingTip stepKey="pgrs" show={sp.onboarding === "1"} />
      <PgrForm companies={companies} />
    </div>
  );
}
