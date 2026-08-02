import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { MedicoForm } from "../_components/medico-form";
import { MedicoIcon } from "../_components/medico-icon";

export const dynamic = "force-dynamic";

export default async function NewMedicoPage() {
  await requireOfficeStaffPage();
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/medicos"
        icon={<MedicoIcon />}
        title="Novo médico"
        description="Médico do trabalho responsável por exames e ASOs"
      />
      <MedicoForm />
    </div>
  );
}
