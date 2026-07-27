import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../_ui/list";
import { GesForm } from "../_components/ges-form";

export const dynamic = "force-dynamic";

export default async function NewGesPage() {
  await requireOfficeStaffPage();
  const result = await listCompanyOptionsAction();
  const companies = result.ok ? result.data : [];

  const gesIcon = (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="7" cy="8" r="3" />
      <circle cx="17" cy="8" r="3" />
      <path d="M2 20a5 5 0 0 1 10 0M12 20a5 5 0 0 1 10 0" />
    </svg>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Novo GES"
        description="Empresa → unidade de obra (cascata) e caracterização ambiental."
        icon={gesIcon}
        backHref="/ges"
      />
      <div className="glass-card rounded-[20px] p-6 sm:p-8">
        <GesForm companies={companies} />
      </div>
    </div>
  );
}
