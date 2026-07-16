import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listWorkPermitCompanyOptionsAction } from "@/shared/server/actions/work-permits/work-permits";

import { PageHeader } from "../../_ui/list";
import { PermitForm } from "../_components/permit-form";

export const dynamic = "force-dynamic";

export default async function NovaPermissaoTrabalhoPage() {
  await requireOfficeStaffPage();
  const companiesResult = await listWorkPermitCompanyOptionsAction();
  const companies = companiesResult.ok ? companiesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title="Nova permissão de trabalho" />
      <PermitForm companies={companies} />
      <Link
        href="/permissoes-trabalho"
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
