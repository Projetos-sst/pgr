import Link from "next/link";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { listReviewSamplesAction } from "@/shared/server/actions/pgr/document-reviews";
import { resolvePageParams } from "@/shared/pagination";
import { PageHeader } from "../../../_ui/list";
import { NewSampleForm } from "./forms";
import { DocumentApprovalForm } from "./document-approval-form";
import { getDocumentApprovalAction } from "@/shared/server/actions/pgr/document-approval";
import { listTeamMembers } from "@/shared/server/actions/platform/team";
import {
  RestrictedReviewerForm,
  ReviewSampleDownloadButton,
  ReviewTenantSwitch,
} from "./reviewer-access";
export const dynamic = "force-dynamic";
export default async function ReviewSamplesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; reviewOrg?: string }>;
}) {
  const ctx = await requireTenantContext();
  const { id } = await params;
  const sp = await searchParams;
  if (sp.reviewOrg && sp.reviewOrg !== ctx.tenantId)
    return <ReviewTenantSwitch orgId={sp.reviewOrg} />;
  const { page } = resolvePageParams({ page: Number(sp.page) });
  const result = await listReviewSamplesAction(id, { page });
  const approval = await getDocumentApprovalAction(id);
  const team = ctx.role === "owner" ? await listTeamMembers({ pageSize: 1000 }) : null;
  const members = team?.ok
    ? team.data.rows
        .filter((member) => ["owner", "collaborator", "client"].includes(member.role))
        .map((member) => ({
          value: member.userId,
          label: member.name,
          restricted: member.role === "client",
        }))
    : [];
  if (!result.ok)
    return (
      <p role="alert" className="p-6">
        {result.error.message}
      </p>
    );
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Amostras e revisão técnica do PGR"
        backHref={ctx.role === "client" ? undefined : `/pgr/${id}`}
        description="Preserve a versão analisada, registre pareceres recebidos e acompanhe correções e revalidações."
      />
      {ctx.role === "owner" ? (
        <RestrictedReviewerForm
          pgrId={id}
          reviewerId={
            approval.ok
              ? members.find(
                  (member) =>
                    member.restricted &&
                    member.value === approval.data.assignment?.reviewerUserId,
                )?.value
              : undefined
          }
        />
      ) : null}
      {approval.ok ? (
        <DocumentApprovalForm
          pgrId={id}
          view={approval.data}
          samples={result.data.rows}
          members={members}
        />
      ) : (
        <p role="alert">{approval.error.message}</p>
      )}
      {ctx.role !== "client" ? <NewSampleForm pgrId={id} /> : null}
      {result.data.rows.length === 0 && <p>Nenhuma amostra registrada.</p>}
      {result.data.rows.map((s) => (
        <article key={s.id} className="glass-card rounded-xl p-5">
          <Link className="font-semibold underline" href={`/pgr/${id}/reviews/${s.id}`}>
            Amostra de{" "}
            {new Date(s.createdAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </Link>
          <p>{s.reason}</p>
          <p>
            {s.latestDecision
              ? s.latestDecision.status === "accepted"
                ? "Parecer favorável registrado"
                : "Correções solicitadas"
              : "Aguardando parecer"}{" "}
            ·{" "}
            {s.sourceChanged
              ? "Dados atuais diferem da amostra"
              : "Dados correspondem à amostra"}
          </p>
          <ReviewSampleDownloadButton pgrId={id} sampleId={s.id} />
        </article>
      ))}
      <nav className="flex gap-4" aria-label="Páginas das amostras">
        {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
        {page * 20 < result.data.total && <Link href={`?page=${page + 1}`}>Próxima</Link>}
      </nav>
    </div>
  );
}
