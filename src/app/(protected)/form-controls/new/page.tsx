import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  listFormControlCompanyOptionsAction,
  listFormControlGesOptionsAction,
} from "@/shared/server/actions/documents/form-controls";

import { PageHeader } from "../../_ui/list";
import { FormControlForm } from "../_components/form-control-form";

export const dynamic = "force-dynamic";

export default async function NewFormControlPage() {
  await requireOfficeStaffPage();
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
        title="Novo controle de formulário"
        description="Configure o cabeçalho ISO (FRM/REV/N.C.) para um tipo de documento."
      />
      <FormControlForm companies={companies} gesOptions={gesOptions} />
    </div>
  );
}
