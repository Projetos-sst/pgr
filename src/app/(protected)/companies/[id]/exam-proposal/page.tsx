import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { RiskRef } from "@/shared/domains/medicine/exam-proposal";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getExamProposalAction } from "@/shared/server/actions/medicine/exam-proposal";

import { PageHeader } from "../../../_ui/list";

export const dynamic = "force-dynamic";

const KIND_LABELS = { internal: "PGR da plataforma", external: "PGR externo" } as const;

function RiskList({ title, risks }: { title: string; risks: RiskRef[] }) {
  if (!risks.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-text text-sm font-semibold">
        {title} ({risks.length})
      </h3>
      <ul className="text-text-subtle list-disc pl-5 text-sm">
        {risks.map((risk) => (
          <li key={`${risk.sourceId}-${risk.riskId}`}>
            {risk.exposureGroup}
            {risk.jobRole ? ` · ${risk.jobRole}` : ""}: {risk.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Proposta de exames (MED-15) só leitura. A revisão e a aprovação pelo médico
 * coordenador ainda não existem: dependem de persistência e da identidade do médico
 * (NOB-121). Por isso não há botões de aceitar, retirar ou aprovar.
 */
export default async function ExamProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const result = await getExamProposalAction(id);
  if (!result.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{result.error.message}</p>
        <Link href={`/companies/${id}/services`} className="text-primary underline">
          Consultar serviços da empresa
        </Link>
      </div>
    );
  const proposal = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Proposta de exames — ${company.data.razaoSocial}`}
        backHref={`/companies/${id}/medical-risks`}
        description="Exames complementares sugeridos a partir dos riscos validados, com a referência da NR-7. O médico coordenador revisa, acrescenta ou retira; nada aqui foi aprovado."
      />
      <Link
        href={`/companies/${id}/exam-plan`}
        className="text-primary text-sm underline"
      >
        Plano de exames (rascunho, revisão do coordenador e versões aprovadas)
      </Link>

      <section
        aria-label="Avisos"
        className="glass-card flex flex-col gap-2 rounded-xl p-5"
      >
        {proposal.warnings.map((warning) => (
          <p key={warning} role="note" className="text-sm text-amber-900">
            {warning}
          </p>
        ))}
        <p className="text-text-subtle text-sm">
          {proposal.clinicalExam.text} ({proposal.clinicalExam.reference})
        </p>
      </section>

      <section className="glass-card flex flex-col gap-2 rounded-xl p-5">
        <h2 className="text-text text-base font-semibold">
          Fontes de riscos consideradas
        </h2>
        {proposal.basis.length === 0 ? (
          <p className="text-text-subtle text-sm">
            Nenhuma fonte registrada.{" "}
            <Link
              href={`/companies/${id}/medical-risks`}
              className="text-primary underline"
            >
              Registrar fonte de riscos
            </Link>
          </p>
        ) : (
          <ul className="text-text list-disc pl-5 text-sm">
            {proposal.basis.map((source) => (
              <li key={source.id}>
                {KIND_LABELS[source.kind]}: {source.title} · versão {source.version}
              </li>
            ))}
          </ul>
        )}
      </section>

      {proposal.groups.map((group) => (
        <section
          key={`${group.exposureGroup}-${group.jobRole ?? ""}`}
          className="glass-card flex flex-col gap-4 rounded-xl p-5"
        >
          <h2 className="text-text text-base font-semibold">
            {group.exposureGroup}
            {group.jobRole ? ` · ${group.jobRole}` : ""}
          </h2>
          {group.suggestions.length === 0 ? (
            <p className="text-text-subtle text-sm">
              Nenhum exame complementar sugerido automaticamente para este grupo.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {group.suggestions.map((suggestion) => (
                <li
                  key={suggestion.procedureCode}
                  className="rounded-lg border border-white/50 p-3"
                >
                  <p className="text-text font-semibold">
                    <span className="text-primary font-mono">
                      {suggestion.procedureCode}
                    </span>{" "}
                    {suggestion.procedureDescription}
                  </p>
                  <p className="text-text-subtle text-sm">{suggestion.condition}</p>
                  <p className="text-text-subtle text-sm">
                    Periodicidade: {suggestion.periodicity}
                  </p>
                  {suggestion.notes.map((note) => (
                    <p key={note} className="text-sm text-amber-900">
                      {note}
                    </p>
                  ))}
                  <p className="text-text-subtle text-xs">
                    {suggestion.reference} · riscos de origem:{" "}
                    {suggestion.triggeredBy.map((risk) => risk.description).join("; ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {group.withoutRule.length ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-text text-sm font-semibold">
                Riscos sem regra automática (o coordenador define)
              </h3>
              <ul className="text-text-subtle list-disc pl-5 text-sm">
                {group.withoutRule.map((risk) => (
                  <li key={`${risk.sourceId}-${risk.riskId}`}>
                    {risk.description}: {risk.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      <section className="glass-card flex flex-col gap-3 rounded-xl p-5">
        <h2 className="text-text text-base font-semibold">Fora da proposta</h2>
        <RiskList
          title="Pendentes de validação técnica"
          risks={proposal.excluded.pending}
        />
        <RiskList title="Rejeitados na revisão" risks={proposal.excluded.rejected} />
        <RiskList
          title="Validados em fonte desatualizada"
          risks={proposal.excluded.outdated}
        />
        {proposal.excluded.pending.length +
          proposal.excluded.rejected.length +
          proposal.excluded.outdated.length ===
        0 ? (
          <p className="text-text-subtle text-sm">Nenhum risco fora da proposta.</p>
        ) : null}
        <p className="text-text-subtle text-xs">Regras: {proposal.rulesVersion}</p>
      </section>
    </div>
  );
}
