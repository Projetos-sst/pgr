import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getMedicoAction } from "@/shared/server/actions/pgr/medicos";
import {
  listMedicoLinkInvitationsAction,
  listMedicoUserLinksAction,
} from "@/shared/server/actions/medicine/professional-links";
import { listTeamMembers } from "@/shared/server/actions/platform/team";
import { formatProfessionalRegistration } from "@/shared/domains/pgr/medicos";

import { PageHeader } from "../../../_ui/list";
import { MedicoForm } from "../../_components/medico-form";
import { MedicoIcon } from "../../_components/medico-icon";
import { ProfessionalAccess } from "../../_components/professional-access";

export const dynamic = "force-dynamic";

export default async function EditMedicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getMedicoAction(id);
  if (!result.ok) notFound();
  const m = result.data;
  const canManage = ctx.role === "owner";
  const [links, team, invitations] = await Promise.all([
    listMedicoUserLinksAction(id),
    canManage ? listTeamMembers({ pageSize: 200 }) : null,
    listMedicoLinkInvitationsAction(id),
  ]);

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
      <ProfessionalAccess
        medicoId={m.id}
        canManage={canManage}
        currentUserId={ctx.userId}
        invitations={invitations.ok ? invitations.data : []}
        members={
          team && team.ok
            ? team.data.rows.map((member) => ({
                userId: member.userId,
                label: [member.name || member.email, member.roleLabel]
                  .filter(Boolean)
                  .join(" · "),
              }))
            : []
        }
        links={
          links.ok
            ? links.data.map((l) => ({
                id: l.id,
                userId: l.userId,
                reason: l.reason,
                linkedAt: new Date(l.linkedAt).toISOString(),
                revokedAt: l.revokedAt ? new Date(l.revokedAt).toISOString() : null,
                revokeReason: l.revokeReason,
                legacy: l.invitationId === null,
              }))
            : []
        }
      />
    </div>
  );
}
