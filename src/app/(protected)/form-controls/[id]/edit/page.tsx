import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getFormControlAction,
  listFormControlCompanyOptionsAction,
  listFormControlGesOptionsAction,
} from "@/shared/server/actions/documents/form-controls";

import { PageHeader } from "../../../_ui/list";
import { DeleteFormControl } from "../../_components/delete-form-control";
import { FormControlForm } from "../../_components/form-control-form";

export const dynamic = "force-dynamic";

export default async function EditFormControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getFormControlAction(id);
  if (!result.ok) notFound();
  const { control } = result.data;

  const [companiesResult, gesResult] = await Promise.all([
    listFormControlCompanyOptionsAction(),
    listFormControlGesOptionsAction(),
  ]);
  const companies = companiesResult.ok ? companiesResult.data : [];
  const gesOptions = gesResult.ok ? gesResult.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/form-controls"
        title={`Editar controle · ${control.frmCode}`}
        description="Altere os dados do cabeçalho ISO ou exclua este controle."
        action={
          <DeleteFormControl id={control.id} redirectTo="/form-controls" hasLabel />
        }
      />
      <FormControlForm
        id={control.id}
        companies={companies}
        gesOptions={gesOptions}
        initial={{
          formType: control.formType,
          companyId: control.companyId,
          frmCode: control.frmCode,
          revision: control.revision,
          issueDate: control.issueDate,
          nonConformityNumber: control.nonConformityNumber,
          gesId: control.gesId,
          position: control.position,
          type: control.type,
          status: control.status,
          notes: control.notes,
        }}
      />
    </div>
  );
}
