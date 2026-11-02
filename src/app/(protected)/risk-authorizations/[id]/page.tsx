import Link from "next/link";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { getRiskAuthorizationWorkspaceAction } from "@/shared/server/actions/medicine/risk-authorizations";
import { MEDICAL_RISK_STATUS_LABELS } from "@/shared/domains/medicine/risk-sources";
import { riskAgentTypeLabel } from "@/shared/domains/pgr/risks";
import { resolvePageParams } from "@/shared/pagination";
import { PageHeader } from "../../_ui/list";
import { listRiskAbsenceAction } from "@/shared/server/actions/medicine/risk-absence";
import { RiskAbsenceSection } from "../../companies/[id]/medical-risks/risk-absence-section";
import { AuthorizationForms, RiskDecisionForm } from "./forms";
export const dynamic = "force-dynamic";
const date = (value: Date) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
export default async function RiskAuthorizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireTenantContext();
  const { id } = await params;
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const result = await getRiskAuthorizationWorkspaceAction(id, { page });
  if (!result.ok)
    return (
      <div className="p-6">
        <p role="alert">{result.error.message}</p>
        <Link href="/risk-authorizations">Voltar</Link>
      </div>
    );
  const view = result.data;
  // Declarações de inexistência (NOB-156): quem valida riscos também declara, aqui.
  const absence = view.inventory ? await listRiskAbsenceAction(id) : null;
  const label = (userId: string) =>
    view.candidates.find((c) => c.userId === userId)?.label ??
    view.professionals.find((p) => p.userId === userId)?.identity.fullName ??
    userId;
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Autorização e revisão — ${view.company.name}`}
        backHref="/risk-authorizations"
        description="A indicação, a autorização profissional e a validação de riscos são permissões separadas."
      />
      {(view.canAppoint || view.canAuthorize) && (
        <p>
          Autorizador atual:{" "}
          {view.authorizer?.userId ? label(view.authorizer.userId) : "Nenhum indicado"}.{" "}
          {view.authorizer &&
            `Indicação registrada em ${date(view.authorizer.recordedAt)}.`}
        </p>
      )}
      {view.candidatesNotice && <p role="status">{view.candidatesNotice}</p>}
      <AuthorizationForms
        companyId={id}
        canAppoint={view.canAppoint}
        canAuthorize={view.canAuthorize}
        candidates={view.candidates}
        currentAuthorizer={view.authorizer?.userId ?? null}
      />
      <section className="glass-card rounded-xl p-5">
        <h2 className="font-semibold">Autorizações profissionais</h2>
        {view.professionals.length === 0 && <p>Nenhuma autorização registrada.</p>}
        {view.professionals.map((professional) => (
          <p key={professional.id} className="mt-3">
            {professional.identity.fullName} · {professional.identity.profession} ·{" "}
            {professional.active ? "Autorização ativa" : "Revogada"} ·{" "}
            {professional.identity.registration.kind === "registered"
              ? `${professional.identity.registration.council} ${professional.identity.registration.number} ${professional.identity.registration.region ?? ""}`
              : `Registro não aplicável: ${professional.identity.registration.reason}`}{" "}
            · {date(professional.authorizedAt)}
          </p>
        ))}
      </section>
      <section>
        <h2 className="font-semibold">Riscos registrados para Medicina</h2>
        {view.inventoryNotice && <p role="alert">{view.inventoryNotice}</p>}
        {view.inventory && (
          <>
            <p className="my-3 text-sm">{view.inventory.validationNotice}</p>
            {view.inventory.rows.length === 0 && (
              <p>
                Nenhuma fonte registrada. A equipe operacional precisa registrar uma fonte
                antes da revisão.
              </p>
            )}
            {view.inventory.rows.map((source) => (
              <section key={source.id} className="glass-card my-4 rounded-xl p-5">
                <h3 className="font-semibold">
                  {source.title} — {source.version}
                </h3>
                <p className="text-sm">Origem: {source.reference}</p>
                <ul className="my-3 text-sm text-amber-900">
                  {source.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                {source.risks.map((risk) => (
                  <article key={risk.id} className="my-3 rounded-xl border p-4">
                    <h4 className="font-medium">{risk.content.description}</h4>
                    <p>
                      {riskAgentTypeLabel(risk.content.agentType)} · Grupo:{" "}
                      {risk.content.exposureGroup}
                      {risk.content.jobRole ? ` · Função: ${risk.content.jobRole}` : ""}
                    </p>
                    {risk.content.possibleInjuries && (
                      <p>Lesões informadas: {risk.content.possibleInjuries}</p>
                    )}
                    {risk.content.exposureDescription && (
                      <p>Exposição: {risk.content.exposureDescription}</p>
                    )}
                    <p>
                      {MEDICAL_RISK_STATUS_LABELS[risk.status]} ·{" "}
                      {risk.usableForPcmso
                        ? "Disponível para consulta no PCMSO"
                        : "Não liberado para uso no PCMSO"}
                    </p>
                    {risk.reviewedAt && (
                      <p>
                        Revisão: {label(risk.reviewedBy ?? "")} · {date(risk.reviewedAt)}{" "}
                        · {risk.reviewNote}
                      </p>
                    )}
                    {view.canReview && (
                      <RiskDecisionForm
                        companyId={id}
                        entryId={risk.id}
                        status={risk.status}
                        reviewedAt={
                          risk.reviewedAt ? new Date(risk.reviewedAt).toISOString() : null
                        }
                      />
                    )}
                  </article>
                ))}
              </section>
            ))}
          </>
        )}
      </section>
      {view.inventory && absence?.ok ? (
        <RiskAbsenceSection
          companyId={id}
          data={absence.data}
          sources={view.inventory.rows}
        />
      ) : null}
      <section>
        <h2 className="font-semibold">Histórico de indicação e autorizações</h2>
        {view.history.rows.map((event) => (
          <article key={event.id} className="my-3 rounded-xl border p-3">
            <p>
              {date(event.createdAt)} · {label(event.actor)} ·{" "}
              {event.event === "authorizer_appointed"
                ? "Indicação de autorizador"
                : event.event === "authorizer_revoked"
                  ? "Revogação de indicação"
                  : event.event === "professional_authorized"
                    ? "Autorização profissional"
                    : "Revogação profissional"}
              {event.subjectUserId ? ` · ${label(event.subjectUserId)}` : ""}
            </p>
            <details>
              <summary>Motivo e evidência registrados</summary>
              <p className="text-sm">
                {typeof (event.details.next as Record<string, unknown> | undefined)
                  ?.reason === "string"
                  ? String((event.details.next as Record<string, unknown>).reason)
                  : "Motivo preservado no histórico."}
              </p>
              {typeof (event.details.next as Record<string, unknown> | undefined)
                ?.evidence === "string" && (
                <p className="text-sm">
                  Evidência:{" "}
                  {String((event.details.next as Record<string, unknown>).evidence)}
                </p>
              )}
            </details>
          </article>
        ))}
      </section>
      <section>
        <h2 className="font-semibold">Histórico de decisões técnicas</h2>
        {view.reviews.rows.map((review) => (
          <article key={review.id} className="my-3 rounded-xl border p-3">
            <p>
              {date(review.reviewedAt)} · {review.identity.fullName} ·{" "}
              {review.identity.profession} ·{" "}
              {review.status === "validated" ? "Validado" : "Rejeitado"}
            </p>
            <p>
              {review.identity.registration.kind === "registered"
                ? `${review.identity.registration.council} ${review.identity.registration.number}`
                : `Registro não aplicável: ${review.identity.registration.reason}`}
            </p>
            <p>{review.reason}</p>
          </article>
        ))}
      </section>
      <nav aria-label="Páginas da revisão" className="flex gap-4">
        {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
        {page * 20 <
          Math.max(
            view.history.total,
            view.reviews.total,
            view.inventory?.total ?? 0,
          ) && <Link href={`?page=${page + 1}`}>Próxima</Link>}
      </nav>
    </div>
  );
}
