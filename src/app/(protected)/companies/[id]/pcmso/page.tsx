import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { PcmsoContent } from "@/shared/domains/medicine/pcmso-composition";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getPcmsoReadinessAction } from "@/shared/server/actions/medicine/pcmso-readiness";
import {
  getPcmsoDocumentAction,
  listPcmsoDocumentsAction,
} from "@/shared/server/actions/medicine/pcmso-documents";

import { PageHeader } from "../../../_ui/list";
import { GeneratePcmsoForm } from "./generate-form";

export const dynamic = "force-dynamic";

function Preview({
  content,
  version,
  hash,
}: {
  content: PcmsoContent;
  version: number;
  hash: string;
}) {
  return (
    <article className="glass-card flex flex-col gap-4 rounded-xl p-5 text-sm">
      <p role="note" className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-900">
        {content.notice}
      </p>
      <header className="flex flex-col gap-1">
        <h2 className="text-text text-base font-semibold">
          PCMSO · versão {version} · ciclo de planejamento {content.planningCycle.start} a{" "}
          {content.planningCycle.end}
        </h2>
        <p className="text-text-subtle text-xs">SHA-256 {hash}</p>
      </header>
      <section>
        <h3 className="text-text font-semibold">Ciclo, revisão e relatório analítico</h3>
        <p className="text-text-subtle">{content.planningCycle.basis}</p>
        <ul className="text-text-subtle list-disc pl-5">
          {content.revision.triggers.map((trigger) => (
            <li key={trigger}>Revisão: {trigger}</li>
          ))}
          <li>{content.revision.administrativeUpdate}</li>
          <li>
            Relatório analítico: {content.analyticalReport.frequency}{" "}
            {content.analyticalReport.note}
          </li>
        </ul>
      </section>
      <section>
        <h3 className="text-text font-semibold">Empresa</h3>
        <p className="text-text-subtle">
          {content.company.razaoSocial} · CNPJ {content.company.cnpj} · CNAE{" "}
          {content.company.cnae} · {content.company.mainActivity} · grau de risco{" "}
          {content.company.riskGrade} · {content.company.activeEmployees} empregado(s)
        </p>
      </section>
      <section>
        <h3 className="text-text font-semibold">Médico responsável pelo PCMSO</h3>
        <p className="text-text-subtle">
          {content.coordinator.name} · CRM {content.coordinator.crm}
          {content.coordinator.registrationUf
            ? `/${content.coordinator.registrationUf}`
            : ""}
          {content.coordinator.rqe
            ? ` · RQE ${content.coordinator.rqe}`
            : ` · sem RQE (NR-7 7.5.2: ${content.coordinator.rqeExceptionReason})`}
        </p>
      </section>
      <section>
        <h3 className="text-text font-semibold">Base de riscos e plano de exames</h3>
        <p className="text-text-subtle">
          Fontes:{" "}
          {content.riskBasis.sources
            .map((s) => `${s.title} (versão ${s.version})`)
            .join("; ")}{" "}
          · plano de exames versão {content.examPlan.version}, aprovado por{" "}
          {content.examPlan.approvedBy || "médico coordenador"} em{" "}
          {content.examPlan.approvedAt.slice(0, 10)}
        </p>
        <p className="text-text-subtle">
          {content.clinicalExam.text} ({content.clinicalExam.reference})
        </p>
      </section>
      {content.groups.map((group) => (
        <section
          key={`${group.exposureGroup}-${group.jobRole}`}
          className="flex flex-col gap-1"
        >
          <h3 className="text-text font-semibold">
            {group.exposureGroup}
            {group.jobRole ? ` · ${group.jobRole}` : ""}
          </h3>
          <ul className="text-text-subtle list-disc pl-5">
            {group.risks.map((risk) => (
              <li key={risk.description}>
                Risco: {risk.description}
                {risk.possibleInjuries
                  ? ` — possíveis agravos: ${risk.possibleInjuries}`
                  : ""}
              </li>
            ))}
            {group.exams.map((exam) => (
              <li key={exam.procedureCode}>
                Exame {exam.procedureCode} {exam.description} — {exam.periodicity}
              </li>
            ))}
            {group.exams.length === 0 ? <li>Somente exame clínico.</li> : null}
          </ul>
        </section>
      ))}
      <section>
        <h3 className="text-text font-semibold">Médicos examinadores</h3>
        <p className="text-text-subtle">
          {content.examiners.map((e) => `${e.name} (${e.registration})`).join("; ")}
        </p>
      </section>
      {content.pendingSections.length ? (
        <section>
          <h3 className="text-text font-semibold">
            Seções pendentes (ainda sem cadastro no sistema)
          </h3>
          <ul className="text-text-subtle list-disc pl-5">
            {content.pendingSections.map((p) => (
              <li key={p.code}>
                {p.message} ({p.reference})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

/**
 * PCMSO da empresa (NOB-151): gera e arquiva prévias versionadas a partir da conferência sem
 * bloqueios. Não há emissão oficial nem assinatura: dependem do provedor de assinatura (MED-12).
 */
export default async function PcmsoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const [docs, readiness] = await Promise.all([
    listPcmsoDocumentsAction(id),
    getPcmsoReadinessAction(id),
  ]);
  if (!docs.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{docs.error.message}</p>
      </div>
    );
  const latest = docs.data[0] ? await getPcmsoDocumentAction(docs.data[0].id) : null;
  const blocking = readiness.ok
    ? readiness.data.items.filter((item) => item.severity === "blocking")
    : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`PCMSO — ${company.data.razaoSocial}`}
        backHref={`/companies/${id}/pcmso-readiness`}
        description="Composição do PCMSO a partir dos riscos validados e do plano de exames aprovado pelo médico coordenador. Cada geração é uma prévia arquivada, sem assinatura."
      />
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5">
        {blocking.length ? (
          <p role="status" className="text-sm text-amber-900">
            A prévia não pode ser gerada: {blocking.length} pendência(s) na{" "}
            <Link href={`/companies/${id}/pcmso-readiness`} className="underline">
              conferência do PCMSO
            </Link>
            .
          </p>
        ) : (
          <GeneratePcmsoForm companyId={id} />
        )}
        <p className="text-text-subtle text-xs">
          Emissão oficial e assinatura do médico responsável ainda não estão disponíveis
          no sistema.
        </p>
      </section>
      {latest?.ok ? (
        <Preview
          content={latest.data.content as PcmsoContent}
          version={latest.data.version}
          hash={latest.data.contentSha256}
        />
      ) : null}
      {docs.data.length ? (
        <section className="glass-card flex flex-col gap-2 rounded-xl p-5">
          <h2 className="text-text text-base font-semibold">Versões arquivadas</h2>
          <ul className="text-text-subtle list-disc pl-5 text-sm">
            {docs.data.map((doc) => (
              <li key={doc.id}>
                Versão {doc.version} · prévia · ciclo {doc.cycleStart} a {doc.cycleEnd} ·
                gerada em {new Date(doc.generatedAt).toISOString().slice(0, 10)} · SHA-256{" "}
                {doc.contentSha256.slice(0, 12)}…
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
