import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { GesForm } from "../_components/ges-form";

export const dynamic = "force-dynamic";

export default async function NewGesPage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Novo GES" description="Empresa → unidade de obra (cascata)." />
      <GesForm companies={companies} />
    </div>
  );
}
