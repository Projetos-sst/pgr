import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDate, formatInstantDateTime } from "@/shared/dates";
import { getProcedure } from "@/shared/domains/medicine/procedure-catalog";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import {
  getExamPlanAction,
  listExamPlansAction,
} from "@/shared/server/actions/medicine/exam-plans";

import { PageHeader } from "../../../_ui/list";
import {
  AddItemForm,
  ApproveForm,
  CreateDraftButton,
  ItemDecisionForm,
} from "./plan-controls";

export const dynamic = "force-dynamic";

const STATUS = {
  draft: "Rascunho",
  approved: "Aprovado",
  superseded: "Substituído",
} as const;

/**
 * Plano de exames (NOB-150): a equipe prepara o rascunho; só a coordenadora do PCMSO com
 * acesso vinculado decide e aprova (regra no servidor e na RLS — os formulários só refletem).
 */
export default async function ExamPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const list = await listExamPlansAction(id);
  if (!list.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{list.error.message}</p>
      </div>
    );
  const current =
    list.data.find((p) => p.status === "draft") ??
    list.data.find((p) => p.status === "approved");
  const detail = current ? await getExamPlanAction(current.id) : null;
  const plan = detail?.ok ? detail.data : null;
  const editable = plan?.status === "draft" && plan.canDecide;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Plano de exames — ${company.data.razaoSocial}`}
        backHref={`/companies/${id}/exam-proposal`}
        description="Exames por grupo de exposição. A equipe prepara o rascunho a partir dos riscos validados; o médico coordenador decide e aprova."
      />

      {!list.data.some((p) => p.status === "draft") ? (
        <section className="glass-card flex flex-col gap-2 rounded-xl p-5">
          <p className="text-text-subtle text-sm">
            {list.data.length
              ? "Para alterar o plano aprovado, prepare uma nova versão; o aprovado não muda."
              : "Nenhum plano preparado ainda."}
          </p>
          <CreateDraftButton companyId={id} />
        </section>
      ) : null}

      {plan ? (
        <section className="glass-card flex flex-col gap-4 rounded-xl p-5">
          <h2 className="text-text text-base font-semibold">
            Versão {plan.version} · {STATUS[plan.status]}
          </h2>
          {plan.status === "draft" && !plan.canDecide ? (
            <p role="note" className="text-sm text-amber-900">
              Somente o médico coordenador do PCMSO desta empresa, com acesso vinculado,
              pode decidir e aprovar. Vincule a conta em Médicos → editar → Acesso do
              profissional.
            </p>
          ) : null}
          {plan.approvedAt ? (
            <p className="text-text-subtle text-sm">
              Aprovado em {formatInstantDate(plan.approvedAt)}
              {plan.approvalNote ? ` · ${plan.approvalNote}` : ""}
            </p>
          ) : null}
          {plan.items.length === 0 ? (
            <p className="text-text-subtle text-sm">
              Nenhum exame complementar sugerido pelos riscos validados. O exame clínico é
              sempre obrigatório (NR-7, itens 7.5.6 e 7.5.7).
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {plan.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-white/50 p-3 text-sm"
                >
                  <p className="text-text font-semibold">
                    <span className="text-primary font-mono">{item.procedureCode}</span>{" "}
                    {item.otherDescription ??
                      getProcedure(item.procedureCode)?.description}
                    {item.decision === "removed" ? " — retirado" : ""}
                  </p>
                  <p className="text-text-subtle">
                    {item.exposureGroup}
                    {item.jobRole ? ` · ${item.jobRole}` : ""} ·{" "}
                    {item.origin === "suggested"
                      ? "sugerido pela regra"
                      : "acrescentado pelo médico"}
                  </p>
                  <p className="text-text-subtle">Periodicidade: {item.periodicity}</p>
                  {item.justification ? (
                    <p className="text-text-subtle">
                      Justificativa: {item.justification}
                    </p>
                  ) : null}
                  {editable ? (
                    <ItemDecisionForm
                      planId={plan.id}
                      itemId={item.id}
                      decision={item.decision}
                      periodicity={item.periodicity}
                      justification={item.justification}
                      origin={item.origin}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {editable ? (
            <>
              <h3 className="text-text text-sm font-semibold">Acrescentar exame</h3>
              <AddItemForm planId={plan.id} />
              <h3 className="text-text text-sm font-semibold">Aprovação</h3>
              <ApproveForm planId={plan.id} />
            </>
          ) : null}
          <details>
            <summary className="text-text cursor-pointer text-sm font-semibold">
              Histórico de decisões ({plan.events.length})
            </summary>
            <ul className="text-text-subtle list-disc pl-5 text-xs">
              {plan.events.map((event) => (
                <li key={event.id}>
                  {formatInstantDateTime(event.createdAt)} · {event.event} · {event.actor}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}

      {list.data.length > 1 ? (
        <section className="glass-card flex flex-col gap-2 rounded-xl p-5">
          <h2 className="text-text text-base font-semibold">Versões</h2>
          <ul className="text-text-subtle list-disc pl-5 text-sm">
            {list.data.map((p) => (
              <li key={p.id}>
                Versão {p.version} · {STATUS[p.status]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link
        href={`/companies/${id}/exam-proposal`}
        className="text-primary text-sm underline"
      >
        Ver a proposta atual a partir dos riscos
      </Link>
    </div>
  );
}
