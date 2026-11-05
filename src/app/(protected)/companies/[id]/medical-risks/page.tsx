import { resolvePageParams } from "@/shared/pagination";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { listPgrAction } from "@/shared/server/actions/pgr/pgr";
import { getMedicalRiskInventoryAction } from "@/shared/server/actions/medicine/risk-sources";
import {
  MEDICAL_RISK_STATUS_LABELS,
  MEDICAL_SOURCE_STATUS_LABELS,
} from "@/shared/domains/medicine/risk-sources";
import { riskAgentTypeLabel } from "@/shared/domains/pgr/risks";
import { PageHeader } from "../../../_ui/list";
import { listRiskAbsenceAction } from "@/shared/server/actions/medicine/risk-absence";
import { RiskAbsenceSection } from "./risk-absence-section";
import { SourceForm } from "./source-form";

export const dynamic = "force-dynamic";
export default async function MedicalRisksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const inventory = await getMedicalRiskInventoryAction(id, { page });
  if (!inventory.ok)
    return (
      <div className="p-6">
        <p role="alert">{inventory.error.message}</p>
        <Link href={`/companies/${id}/services`}>Consultar serviços da empresa</Link>
      </div>
    );
  const [pgrs, absence] = await Promise.all([
    listPgrAction({ companyId: id, pageSize: 100 }),
    listRiskAbsenceAction(id),
  ]);
  const sourceOptions = inventory.data.rows
    .filter((source) => !source.superseded)
    .map((source) => ({ id: source.id, label: `${source.title} — ${source.version}` }));
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Riscos para Medicina — ${company.data.razaoSocial}`}
        backHref="/medical-risks"
        description="Consulte fontes para elaboração do PCMSO, mesmo sem programa cadastrado."
      />
      <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        {inventory.data.validationNotice}
      </p>
      <Link href={`/companies/${id}/exam-proposal`} className="text-primary underline">
        Proposta de exames a partir dos riscos validados
      </Link>
      <Link href={`/risk-authorizations/${id}`} className="text-primary underline">
        Indicação do autorizador, permissões profissionais e revisão dos riscos
      </Link>
      <Link
        href={`/companies/${id}/pcmso-coordinator`}
        className="text-primary underline"
      >
        Coordenador do PCMSO (médico responsável e histórico)
      </Link>
      <Link href={`/companies/${id}/pcmso-readiness`} className="text-primary underline">
        Conferência dos dados do PCMSO
      </Link>
      <SourceForm
        companyId={id}
        pgrs={
          pgrs.ok
            ? pgrs.data.rows.map((pgr) => ({
                id: pgr.id,
                label: `${pgr.workUnitName ?? "PGR"} — ${pgr.issuedAt ?? "sem data"}`,
              }))
            : []
        }
        sources={sourceOptions}
      />
      <h2 className="font-semibold">Fontes registradas ({inventory.data.total})</h2>
      {inventory.data.rows.length === 0 && (
        <p>
          Nenhuma fonte disponível. Registre o PGR de origem para disponibilizar os riscos
          à Medicina.
        </p>
      )}
      {inventory.data.rows.map((source) => (
        <section key={source.id} className="glass-card rounded-[20px] p-6">
          <h3 className="font-semibold">
            {source.title} — {source.version}
          </h3>
          <p className="text-sm font-semibold">
            {MEDICAL_SOURCE_STATUS_LABELS[source.status]}
          </p>
          <p className="text-text-muted text-sm">
            {source.kind === "external" ? "PGR externo" : "PGR da plataforma"} ·{" "}
            {source.reference}
          </p>
          {source.kind === "external" &&
          (source.documentDate || source.preparedBy || source.reviewDueOn) ? (
            <p className="text-text-muted text-sm">
              {[
                source.documentDate ? `Documento de ${source.documentDate}` : null,
                source.preparedBy ? `elaborado por ${source.preparedBy}` : null,
                source.reviewDueOn ? `revisão informada até ${source.reviewDueOn}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          <p className="text-text-muted text-sm">
            Registrado por {source.registeredBy} em{" "}
            {new Date(source.registeredAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </p>
          <ul className="my-3 text-sm text-amber-900">
            {source.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <ul className="space-y-3">
            {source.risks.map((risk) => (
              <li key={risk.id} className="rounded-xl border border-white/70 p-3">
                <p className="font-medium">
                  {riskAgentTypeLabel(risk.content.agentType)} —{" "}
                  {risk.content.description}
                </p>
                <p className="text-sm">
                  Grupo: {risk.content.exposureGroup}
                  {risk.content.jobRole ? ` · Função: ${risk.content.jobRole}` : ""}
                </p>
                {risk.content.possibleInjuries && (
                  <p className="text-sm">
                    Possíveis lesões informadas na origem: {risk.content.possibleInjuries}
                  </p>
                )}
                {risk.content.exposureDescription && (
                  <p className="text-sm">
                    Exposição informada na origem: {risk.content.exposureDescription}
                  </p>
                )}
                {risk.content.noxiousAgentCode && (
                  <p className="text-sm">
                    Agente nocivo (Tabela 24, conforme a origem):{" "}
                    {risk.content.noxiousAgentCode}
                  </p>
                )}
                <p
                  className={
                    risk.status === "rejected"
                      ? "text-danger text-sm"
                      : risk.status === "validated"
                        ? "text-sm text-green-800"
                        : "text-sm text-amber-900"
                  }
                >
                  {MEDICAL_RISK_STATUS_LABELS[risk.status]} ·{" "}
                  {risk.usableForPcmso
                    ? "Validado para consulta no PCMSO"
                    : "Não liberado para uso no PCMSO"}
                </p>
                {risk.reviewedBy && (
                  <p className="text-text-muted text-sm">
                    Revisado por {risk.reviewedBy} em{" "}
                    {risk.reviewedAt?.toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                    : {risk.reviewNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {absence.ok ? (
        <RiskAbsenceSection
          companyId={id}
          data={absence.data}
          sources={inventory.data.rows}
        />
      ) : null}
      <nav aria-label="Páginas das fontes" className="flex gap-4">
        {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
        {page * 20 < inventory.data.total && (
          <Link href={`?page=${page + 1}`}>Próxima</Link>
        )}
      </nav>
    </div>
  );
}
