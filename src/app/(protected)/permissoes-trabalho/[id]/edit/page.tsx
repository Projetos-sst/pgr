import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getWorkPermitAction,
  listWorkPermitCompanyOptionsAction,
} from "@/shared/server/actions/work-permits/work-permits";

import { PageHeader } from "../../../_ui/list";
import { PermitForm } from "../../_components/permit-form";

export const dynamic = "force-dynamic";

export default async function EditarPermissaoTrabalhoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getWorkPermitAction(id);
  if (!result.ok) notFound();
  const { permit } = result.data;
  const companiesResult = await listWorkPermitCompanyOptionsAction();
  const companies = companiesResult.ok ? companiesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader title={`Editar PT ${permit.number}`} />
      <PermitForm
        id={id}
        companies={companies}
        initial={{
          number: permit.number,
          type: permit.type,
          status: permit.status,
          companyId: permit.companyId,
          area: permit.area,
          description: permit.description,
          validFrom: permit.validFrom,
          validUntil: permit.validUntil,
          requestedBy: permit.requestedBy,
          approvedBy: permit.approvedBy,
          precautions: permit.precautions,
          notes: permit.notes,
        }}
      />
      <Link
        href="/permissoes-trabalho"
        className="text-text-subtle text-sm hover:underline"
      >
        ← Voltar
      </Link>
    </div>
  );
}
