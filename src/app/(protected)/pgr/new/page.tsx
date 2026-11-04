import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { pgrCompanyAvailability } from "@/shared/domains/pgr/company-availability";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { OnboardingTip } from "../../_components/onboarding-tip";
import { CompanyAvailabilityNotice } from "../_components/company-availability-notice";
import { PgrForm } from "../_components/pgr-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ onboarding?: string }>;

export default async function NewPgrPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireOfficeStaffPage();
  // Mesmo tenant e mesma sessão: as habilitadas para PGR (seletor) e todas as do escritório (para
  // explicar as que não aparecem). Nenhuma empresa de outro escritório entra em nenhuma das listas.
  const [eligible, all, sp] = await Promise.all([
    listCompanyOptionsAction("pgr"),
    listCompanyOptionsAction(),
    searchParams,
  ]);
  const companies = eligible.ok ? eligible.data : [];
  const availability = pgrCompanyAvailability(
    all.ok ? all.data : null,
    eligible.ok ? eligible.data : null,
  );

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/pgr"
        title="Novo PGR"
        description="Documento de Gerenciamento de Riscos Ocupacionais (NR-01/GRO). A criação exige o aceite da Declaração de Ciência de Riscos."
      />
      <OnboardingTip stepKey="pgrs" show={sp.onboarding === "1"} />
      <CompanyAvailabilityNotice
        availability={availability}
        canManageServices={ctx.role === "owner"}
      />
      <PgrForm companies={companies} />
    </div>
  );
}
