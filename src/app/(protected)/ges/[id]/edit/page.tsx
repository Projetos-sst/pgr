import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getGesAction } from "@/shared/server/actions/pgr/ges";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../../_ui/list";
import { GesForm } from "../../_components/ges-form";
import { DeleteGes } from "../../_components/delete-ges";
import { ManageFunctions } from "../_components/manage-functions";
import { SuggestRisksSection } from "../_components/suggest-risks-section";
import { ExposedEmployeesSection } from "../_components/exposed-employees-section";
import { GesDocumentsSection } from "../_components/ges-documents-section";

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

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={gesRow.name}
        description="Detalhe, edição e gestão das funções vinculadas."
        backHref="/ges"
        action={<DeleteGes id={gesRow.id} redirectTo="/ges" hasLabel />}
      />
      <GesForm companies={companies} ges={gesRow} exposedWorkers={exposedWorkers} />
      <ManageFunctions gesId={gesRow.id} />
      <SuggestRisksSection gesId={gesRow.id} />
      <ExposedEmployeesSection gesId={gesRow.id} />
      <GesDocumentsSection gesId={gesRow.id} gesName={gesRow.name} />
    </div>
  );
}
