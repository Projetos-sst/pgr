import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDate } from "@/shared/dates";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { listInterpretationCriteriaAction } from "@/shared/server/actions/medicine/interpretation-criteria";

import { PageHeader } from "../../../_ui/list";
import { CriteriaForm } from "./criteria-form";

export const dynamic = "force-dynamic";

/**
 * Critérios de interpretação e condutas por exame (NOB-153, NR-7 7.5.4 c). Texto do médico
 * coordenador, com versões. A equipe vê; só a conta vinculada ao coordenador registra.
 */
export default async function InterpretationCriteriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const result = await listInterpretationCriteriaAction(id);
  if (!result.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{result.error.message}</p>
      </div>
    );
  const { approvedPlanVersion, rows, missing } = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Critérios de interpretação — ${company.data.razaoSocial}`}
        backHref={`/companies/${id}/pcmso-readiness`}
        description="Critérios de interpretação dos achados e planejamento das condutas por exame do plano aprovado (NR-7 7.5.4 c). O texto é do médico coordenador; o sistema não gera nem sugere."
      />
      <section className="glass-card flex flex-col gap-2 rounded-xl p-5 text-sm">
        {approvedPlanVersion === null ? (
          <p role="status">
            Ainda não há plano de exames aprovado. Os critérios se referem aos exames do
            plano aprovado pelo coordenador.
          </p>
        ) : (
          <p role="status">
            Plano aprovado versão {approvedPlanVersion}:{" "}
            {missing.length
              ? `${missing.length} exame(s) sem critério do coordenador.`
              : "todos os exames têm critério definido."}
          </p>
        )}
        <p className="text-text-subtle text-xs">
          Só a conta vinculada ao médico coordenador com designação aberta registra
          critérios. Cada registro é uma nova versão; as anteriores ficam no histórico.
        </p>
      </section>
      {rows.map((row) => (
        <article
          key={`${row.procedureCode}-${row.otherDescription ?? ""}`}
          className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm"
        >
          <header className="flex flex-col gap-1">
            <h2 className="text-text text-base font-semibold">
              {row.procedureCode} {row.description}
            </h2>
            <p className="text-text-subtle text-xs">
              {row.inApprovedPlan ? "No plano aprovado" : "Fora do plano aprovado atual"}
              {row.current
                ? ` · versão ${row.current.version} · ${row.current.authorName} · ${formatInstantDate(row.current.authoredAt)}`
                : " · pendente de definição pelo médico coordenador"}
            </p>
          </header>
          {row.current ? (
            <dl className="text-text-subtle grid gap-2">
              <div>
                <dt className="text-text font-semibold">Critérios de interpretação</dt>
                <dd className="whitespace-pre-line">{row.current.criteria}</dd>
              </div>
              <div>
                <dt className="text-text font-semibold">Condutas</dt>
                <dd className="whitespace-pre-line">{row.current.conduct}</dd>
              </div>
            </dl>
          ) : null}
          <CriteriaForm
            companyId={id}
            procedureCode={row.procedureCode}
            otherDescription={row.otherDescription}
            current={
              row.current
                ? { criteria: row.current.criteria, conduct: row.current.conduct }
                : null
            }
          />
        </article>
      ))}
    </div>
  );
}
