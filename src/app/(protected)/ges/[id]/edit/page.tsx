import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getGesAction } from "@/shared/server/actions/pgr/ges";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../../_ui/list";
import { GesForm } from "../../_components/ges-form";
import { DeleteGes } from "../../_components/delete-ges";
import { ManageFunctions } from "../_components/manage-functions";
import { SuggestRisksSection } from "../_components/suggest-risks-section";

export const dynamic = "force-dynamic";

export default async function EditGesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [gesResult, companiesResult] = await Promise.all([
    getGesAction(id),
    listCompanyOptionsAction(),
  ]);
  if (!gesResult.ok) notFound();
  const { ges: gesRow, exposedWorkers } = gesResult.data;
  const companies = companiesResult.ok ? companiesResult.data : [];

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
        title={gesRow.name}
        description="Detalhe, edição e gestão das funções vinculadas."
        icon={gesIcon}
        backHref="/ges"
        action={<DeleteGes id={gesRow.id} redirectTo="/ges" hasLabel />}
      />

      <div className="grid gap-6">
        <div className="glass-card rounded-[20px] p-6 sm:p-8">
          <GesForm companies={companies} ges={gesRow} exposedWorkers={exposedWorkers} />
        </div>
        <ManageFunctions gesId={gesRow.id} />
        <SuggestRisksSection gesId={gesRow.id} />
      </div>
    </div>
  );
}
