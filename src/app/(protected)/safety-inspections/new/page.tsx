import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listSafetyCompanyOptionsAction } from "@/shared/server/actions/inspections/safety-inspections";

import { PageHeader } from "../../_ui/list";
import { HeaderForm } from "../_components/header-form";

export const dynamic = "force-dynamic";

export default async function NovaInspecaoSegurancaPage() {
  await requireOfficeStaffPage();
  const companiesResult = await listSafetyCompanyOptionsAction();
  const companies = companiesResult.ok ? companiesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/safety-inspections"
        title="Nova inspeção de segurança"
        description="Passo 1 de 2 — cabeçalho (categoria, área, empresa)."
      />
      <HeaderForm companies={companies} />
      <Link
        href="/safety-inspections"
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
