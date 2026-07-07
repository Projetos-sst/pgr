import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { PgrForm } from "../_components/pgr-form";

export const dynamic = "force-dynamic";

export default async function NewPgrPage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Novo PGR"
        description="Documento de Gerenciamento de Riscos Ocupacionais (NR-01/GRO). A criação exige o aceite da Declaração de Ciência de Riscos."
      />
      <PgrForm companies={companies} />
    </div>
  );
}
