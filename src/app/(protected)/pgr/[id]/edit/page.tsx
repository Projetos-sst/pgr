import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getPgrAction } from "@/shared/server/actions/pgr/pgr";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { PageHeader } from "../../../_ui/list";
import { PgrForm } from "../../_components/pgr-form";
import { DeletePgr } from "../../_components/delete-pgr";

export const dynamic = "force-dynamic";

export default async function EditPgrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [pgrResult, companyOptions] = await Promise.all([
    getPgrAction(id),
    listCompanyOptionsAction(),
  ]);
  if (!pgrResult.ok) notFound();
  const companies = companyOptions.ok ? companyOptions.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Editar PGR"
        description="Detalhe e edição do documento PGR."
        action={<DeletePgr id={pgrResult.data.id} redirectTo="/pgr" />}
      />
      <PgrForm companies={companies} pgr={pgrResult.data} />
    </div>
  );
}
