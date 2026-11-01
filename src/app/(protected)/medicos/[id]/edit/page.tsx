import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getMedicoAction } from "@/shared/server/actions/pgr/medicos";
import { formatProfessionalRegistration } from "@/shared/domains/pgr/medicos";

import { PageHeader } from "../../../_ui/list";
import { MedicoForm } from "../../_components/medico-form";
import { MedicoIcon } from "../../_components/medico-icon";

export const dynamic = "force-dynamic";

export default async function EditMedicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getMedicoAction(id);
  if (!result.ok) notFound();
  const m = result.data;

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/medicos"
        icon={<MedicoIcon />}
        title="Editar médico"
        description={formatProfessionalRegistration(m)}
      />
      <MedicoForm
        id={m.id}
        initial={{
          name: m.name,
          crm: m.crm,
          profession: m.profession,
          registrationUf: m.registrationUf,
          rqe: m.rqe,
          affiliation: m.affiliation,
          specialty: m.specialty,
          clinic: m.clinic,
          phone: m.phone,
          status: m.status,
        }}
      />
    </div>
  );
}
