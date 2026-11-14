import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDate } from "@/shared/dates";
import type { PcmsoContent } from "@/shared/domains/medicine/pcmso-composition";
import {
  PCMSO_CHANGE_KIND_LABELS,
  PCMSO_SIGNATURE_METHOD_LABELS,
  PCMSO_SIGNED_ORIGIN_LABELS,
  PCMSO_SIGNED_WARNING_LABELS,
  PCMSO_VERIFICATION_LABEL,
} from "@/shared/domains/medicine/pcmso-signed";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getPcmsoReadinessAction } from "@/shared/server/actions/medicine/pcmso-readiness";
import {
  getPcmsoDocumentAction,
  listPcmsoDocumentsAction,
  listSignedPcmsosAction,
} from "@/shared/server/actions/medicine/pcmso-documents";

import { PageHeader } from "../../../_ui/list";
import { SectionLoadError } from "../../../_ui/section-load-error";
import { GeneratePcmsoForm } from "./generate-form";
import { DownloadSignedPcmsoButton, SignedPcmsoForm } from "./signed-pcmso-controls";

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
        {content.riskBasis.origin ? (
          <p className="text-text font-semibold">
            Origem dos riscos: {content.riskBasis.origin}
          </p>
        ) : null}
        <ul className="text-text-subtle list-disc pl-5">
          {content.riskBasis.sources.map((s) => (
            <li key={s.id}>
              {s.origin ? `${s.origin}: ` : ""}
              {s.title} (versão {s.version})
              {s.reference && s.kind === "external" ? ` · documento: ${s.reference}` : ""}
              {s.documentDate ? ` · data do documento ${s.documentDate}` : ""}
              {s.preparedBy ? ` · elaborado por ${s.preparedBy}` : ""}
              {s.kind === "external" && s.lastValidatedOn
                ? ` · ${s.validatedRisks} risco(s) validado(s) até ${s.lastValidatedOn}`
                : ""}
            </li>
          ))}
        </ul>
        <p className="text-text-subtle">
          Plano de exames versão {content.examPlan.version}, aprovado por{" "}
          {content.examPlan.approvedBy || "médico coordenador"} em{" "}
          {formatInstantDate(content.examPlan.approvedAt)}
        </p>
        <p className="text-text-subtle">
          {content.clinicalExam.text} ({content.clinicalExam.reference})
        </p>
      </section>
      {content.interpretation ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-text font-semibold">
            Critérios de interpretação e condutas ({content.interpretation.reference})
          </h3>
          <p className="text-text-subtle">{content.interpretation.authorship}</p>
          <ul className="text-text-subtle list-disc pl-5">
            {content.interpretation.items.map((item) => (
              <li key={`${item.procedureCode}-${item.description}`}>
                {item.procedureCode} {item.description}:{" "}
                {item.status === "defined"
                  ? `${item.criteria} — Condutas: ${item.conduct} (${item.author}, versão ${item.version})`
                  : item.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
 * PCMSO da empresa (NOB-151, NOB-166): gera e arquiva prévias versionadas a partir da conferência
 * sem bloqueios e registra a versão oficial assinada pelo médico responsável (conferência
 * documental; o sistema não assina nem valida assinatura criptograficamente).
 */
export default async function PcmsoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const company = await getCompanyAction(id);
  if (!company.ok) notFound();
  const [docs, readiness, signedDocs] = await Promise.all([
    listPcmsoDocumentsAction(id),
    getPcmsoReadinessAction(id),
    listSignedPcmsosAction(id),
  ]);
  if (!docs.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{docs.error.message}</p>
      </div>
    );
  const latest = docs.data[0] ? await getPcmsoDocumentAction(docs.data[0].id) : null;
  const signed = signedDocs.ok ? signedDocs.data : null;
  const latestContent = latest?.ok ? (latest.data.content as PcmsoContent) : null;
  const blocking = readiness.ok
    ? readiness.data.items.filter((item) => item.severity === "blocking")
    : [];
  // Falha de leitura ≠ vazio: sem a conferência não há geração; sem a lista não há registro às cegas.
  const retryHref = `/companies/${id}/pcmso`;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`PCMSO — ${company.data.razaoSocial}`}
        backHref={`/companies/${id}/pcmso-readiness`}
        description="Composição do PCMSO a partir dos riscos validados e do plano de exames aprovado pelo médico coordenador. Cada geração é uma prévia arquivada, sem assinatura."
      />
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5">
        {!readiness.ok ? (
          <SectionLoadError what="a conferência do PCMSO" retryHref={retryHref} />
        ) : blocking.length ? (
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
          A prévia não é o PCMSO oficial. O sistema não assina: a versão oficial é a
          prévia assinada pelo médico responsável, registrada abaixo.
        </p>
      </section>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">
          PCMSO assinado (versão oficial)
        </h2>
        <p className="text-text-subtle">
          O médico responsável pelo PCMSO (NR-7 7.4.1 c) assina a prévia mais recente, que
          está ligada ao plano de exames aprovado. O sistema guarda o PDF íntegro
          (SHA-256) e a conferência documental da assinatura. Ele não valida a assinatura
          criptograficamente. Mudanças no programa geram nova versão, com tipo de mudança
          e motivo, e a anterior é preservada.
        </p>
        {latestContent ? (
          <p className="text-text-subtle">
            Médico responsável: {latestContent.coordinator.name} · CRM{" "}
            {latestContent.coordinator.crm}/
            {latestContent.coordinator.registrationUf ?? "—"} · plano de exames versão{" "}
            {latestContent.examPlan.version}, aprovado por{" "}
            {latestContent.examPlan.approvedBy}.
          </p>
        ) : null}
        {signed?.warnings.length ? (
          <ul className="list-disc pl-5 text-amber-900">
            {signed.warnings.map((w) => (
              <li key={w}>{PCMSO_SIGNED_WARNING_LABELS[w]}</li>
            ))}
          </ul>
        ) : null}
        {!signedDocs.ok ? (
          <SectionLoadError what="os PCMSOs assinados" retryHref={retryHref} />
        ) : signed?.items.length ? (
          <ul className="flex flex-col gap-2">
            {signed.items.map((doc) => (
              <li key={doc.id} className="text-text-subtle flex flex-col gap-1">
                <span className="text-text font-semibold">
                  {doc.id === signed.currentId ? "Vigente" : "Substituído"} · prévia
                  versão {doc.previewVersion} · ciclo {doc.cycleStart} a {doc.cycleEnd} ·
                  assinado em {doc.signedOn}
                </span>
                <span>
                  {doc.signerName} · CRM {doc.signerRegistration}/{doc.signerUf} ·{" "}
                  {PCMSO_SIGNATURE_METHOD_LABELS[doc.signatureMethod]}
                </span>
                <span>
                  {PCMSO_VERIFICATION_LABEL}: {doc.verificationReference} ·{" "}
                  {PCMSO_SIGNED_ORIGIN_LABELS[doc.origin]}
                </span>
                {doc.changeKind ? (
                  <span>
                    {PCMSO_CHANGE_KIND_LABELS[doc.changeKind]}: {doc.replaceReason}
                  </span>
                ) : null}
                <span className="text-xs">
                  SHA-256 {doc.fileSha256.slice(0, 16)}… · registrado em{" "}
                  {formatInstantDate(doc.registeredAt)}{" "}
                  <DownloadSignedPcmsoButton id={doc.id} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-amber-900">
            Nenhum PCMSO assinado registrado. Até lá, a empresa não tem versão oficial do
            programa no sistema.
          </p>
        )}
        {signedDocs.ok && !(latest && !latest.ok) ? (
          <SignedPcmsoForm
            companyId={id}
            latestPreview={
              docs.data[0] ? { id: docs.data[0].id, version: docs.data[0].version } : null
            }
            coordinator={
              latestContent
                ? {
                    name: latestContent.coordinator.name,
                    crm: latestContent.coordinator.crm,
                    uf: latestContent.coordinator.registrationUf,
                  }
                : null
            }
            currentId={signed?.currentId ?? null}
          />
        ) : null}
      </section>
      {latest && !latest.ok ? (
        <SectionLoadError what="a última prévia" retryHref={retryHref} />
      ) : null}
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
                gerada em {formatInstantDate(doc.generatedAt)} · SHA-256{" "}
                {doc.contentSha256.slice(0, 12)}…
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
