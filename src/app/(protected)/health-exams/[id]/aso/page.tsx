import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDate } from "@/shared/dates";
import { procedureLabel, type AsoContent } from "@/shared/domains/medicine/aso";
import {
  ASO_DELIVERY_EVIDENCE_LABELS,
  ASO_DELIVERY_METHOD_LABELS,
  ASO_DELIVERY_STATE_LABELS,
  ASO_EVIDENCE_REVIEW_METHOD_LABELS,
  ASO_EVIDENCE_REVIEW_RESULT_LABELS,
} from "@/shared/domains/medicine/aso-delivery";
import {
  ASO_SIGNATURE_METHOD_LABELS,
  ASO_SIGNED_CONCLUSION_LABELS,
  ASO_SIGNED_OUTDATED_MESSAGE,
  ASO_SIGNED_ORIGIN_LABELS,
  currentSignedAso,
} from "@/shared/domains/medicine/aso-signed";
import { EXAM_TYPE_LABELS } from "@/shared/domains/pgr/health-exams";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  getAsoDocumentAction,
  getAsoReadinessAction,
  listAsoDocumentsAction,
  listExaminerConclusionsAction,
  listAsoDeliveriesAction,
  listExamProceduresAction,
  listSignedAsosAction,
} from "@/shared/server/actions/medicine/aso";

import { PageHeader } from "../../../_ui/list";
import { SectionLoadError } from "../../../_ui/section-load-error";
import {
  CompanyOriginForm,
  ExaminerConclusionForm,
  GenerateAsoButton,
  ProcedureForm,
  RemoveProcedureButton,
} from "./aso-controls";
import {
  AsoDeliveryEvidenceButton,
  AsoDeliveryForm,
  ReviewAsoEvidenceForm,
  VoidAsoDeliveryForm,
} from "./aso-delivery-controls";
import { DownloadSignedAsoButton, SignedAsoForm } from "./signed-aso-controls";

export const dynamic = "force-dynamic";

const STATUS_LABELS = { ok: "OK", warning: "Atenção", missing: "Pendente" } as const;

function Preview({
  content,
  version,
  hash,
}: {
  content: AsoContent;
  version: number;
  hash: string;
}) {
  const coordinator = content.coordinator
    ? `${content.coordinator.name} · ${content.coordinator.registration}${
        content.coordinator.rqe ? ` · RQE ${content.coordinator.rqe}` : ""
      }`
    : "Não designado na data do exame.";
  return (
    <article className="glass-card flex flex-col gap-4 rounded-xl p-5 text-sm">
      <p role="note" className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-900">
        {content.notice}
      </p>
      <header className="flex flex-col gap-1">
        <h2 className="text-text text-base font-semibold">
          ASO {content.examType.label} · prévia versão {version}
        </h2>
        <p className="text-text-subtle text-xs">SHA-256 {hash}</p>
      </header>
      <dl className="text-text-subtle grid gap-2">
        <div>
          <dt className="text-text font-semibold">a) Organização</dt>
          <dd>
            {content.company.razaoSocial} · CNPJ {content.company.cnpj}
          </dd>
        </div>
        <div>
          <dt className="text-text font-semibold">b) Empregado</dt>
          <dd>
            {content.employee.fullName} · CPF {content.employee.cpf} · função{" "}
            {content.employee.jobRole}
          </dd>
        </div>
        <div>
          <dt className="text-text font-semibold">c) Riscos</dt>
          <dd>
            <ul className="list-disc pl-5">
              {content.risks.map((risk) => (
                <li key={`${risk.agentType}-${risk.description}`}>{risk.description}</li>
              ))}
            </ul>
            {/* Prévias v1 não têm o campo; só a declaração vigente o preenche (NOB-156). */}
            {content.risksAbsence ? (
              <p>
                {content.risksAbsence.statement} Fonte {content.risksAbsence.source.title}{" "}
                — {content.risksAbsence.source.version}
                {content.risksAbsence.declaredBy
                  ? ` · declarada por ${content.risksAbsence.declaredBy}`
                  : ""}{" "}
                em {formatInstantDate(content.risksAbsence.declaredAt)}.
              </p>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-text font-semibold">d) Exames realizados</dt>
          <dd>
            <ul className="list-disc pl-5">
              <li>Exame clínico — {content.procedures.clinical.performedAt}</li>
              {content.procedures.complementary.map((p) => (
                <li key={`${p.procedureCode}-${p.performedAt}-${p.description}`}>
                  {p.procedureCode} {p.description} — {p.performedAt}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-text font-semibold">
            {content.conclusion.source === "examiner_account"
              ? "e) Conclusão do médico examinador"
              : "e) Aptidão informada no cadastro do exame (sem conclusão médica no sistema)"}
          </dt>
          <dd>
            {content.conclusion.label}. {content.conclusion.basis}
          </dd>
        </div>
        <div>
          <dt className="text-text font-semibold">f) Médico responsável pelo PCMSO</dt>
          <dd>{coordinator}</dd>
        </div>
        <div>
          <dt className="text-text font-semibold">g) Médico examinador</dt>
          <dd>
            {content.examiner.name} · {content.examiner.registration} · exame em{" "}
            {content.examiner.examDate}. {content.examiner.signature.note}
          </dd>
        </div>
      </dl>
      {content.warnings.length ? (
        <section>
          <h3 className="text-text font-semibold">Avisos registrados na prévia</h3>
          <ul className="text-text-subtle list-disc pl-5">
            {content.warnings.map((w) => (
              <li key={w.code}>
                {w.message} ({w.reference})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

/**
 * ASO do exame (NOB-152, NOB-163): conferência da NR-7 7.5.19.1, exames complementares
 * realizados, prévias arquivadas e o ASO assinado (documento oficial) registrado com integridade e
 * conferência. O sistema não assina (MED-12). Observações clínicas do exame nunca aparecem aqui.
 */
export default async function AsoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const exam = await getHealthExamAction(id);
  if (!exam.ok) notFound();
  const [readiness, procedures, docs, conclusions, signedDocs, deliveries] =
    await Promise.all([
      getAsoReadinessAction(id),
      listExamProceduresAction(id),
      listAsoDocumentsAction(id),
      listExaminerConclusionsAction(id),
      listSignedAsosAction(id),
      listAsoDeliveriesAction(id),
    ]);
  if (!readiness.ok)
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert">{readiness.error.message}</p>
      </div>
    );
  const procedureRows = procedures.ok ? procedures.data : [];
  const docRows = docs.ok ? docs.data : [];
  const latest = docRows[0] ? await getAsoDocumentAction(docRows[0].id) : null;
  const blocking = readiness.data.items.filter((item) => item.severity === "blocking");
  const has = (code: string) => blocking.some((item) => item.code === code);
  const conclusionRows = conclusions.ok ? conclusions.data : [];
  const signedRows = signedDocs.ok ? signedDocs.data : [];
  const currentSigned = currentSignedAso(signedRows);
  const deliveryData = deliveries.ok ? deliveries.data : null;
  // Falha de leitura ≠ vazio: cada seção avisa a falha e não oferece registro às cegas.
  const retryHref = `/health-exams/${id}/aso`;
  const voidedIds = new Set(
    (deliveryData?.deliveries ?? []).filter((d) => d.voidsId).map((d) => d.voidsId),
  );
  const reviewedIds = new Set(
    (deliveryData?.deliveries ?? [])
      .filter((d) => d.kind === "evidence_reviewed" && !voidedIds.has(d.id))
      .map((d) => d.reviewsId),
  );

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`ASO — ${EXAM_TYPE_LABELS[exam.data.examType]} de ${exam.data.performedAt}`}
        backHref={`/health-exams/${id}/edit`}
        description="Conferência do conteúdo mínimo do ASO (NR-7 7.5.19.1) e prévias arquivadas, montadas só com os dados cadastrados."
      />
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">Conferência (NR-7 7.5.19.1)</h2>
        <ul className="flex flex-col gap-1">
          {readiness.data.checklist.map((row) => (
            <li key={row.item}>
              <span className="font-semibold">{row.item})</span> {row.label} —{" "}
              {STATUS_LABELS[row.status]}
            </li>
          ))}
        </ul>
        <ul className="text-text-subtle list-disc pl-5">
          {readiness.data.items.map((item) => (
            <li key={item.code}>
              {item.severity === "blocking" ? "Bloqueia: " : "Aviso: "}
              {item.message} ({item.reference})
            </li>
          ))}
        </ul>
      </section>
      {has("exam_company_unverified") ? (
        <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
          <h2 className="text-text text-base font-semibold">
            Empresa de origem do exame
          </h2>
          <p className="text-text-subtle">
            Exame registrado antes do controle da empresa de origem (MED-07). O sistema
            não presume a empresa: só o responsável pelo escritório confirma, com
            justificativa, que o exame foi feito na empresa atual do funcionário. A
            confirmação fica registrada com autor e data e não pode ser alterada.
          </p>
          <CompanyOriginForm examId={id} />
        </section>
      ) : null}
      {exam.data.aptitude === "fit_with_restrictions" ? (
        <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
          <h2 className="text-text text-base font-semibold">
            Confirmação do médico examinador
          </h2>
          <p className="text-text-subtle">
            O exame registra “apto com restrição”, e o ASO precisa de apto ou inapto (NR-7
            7.5.19.1 e). O sistema não converte a conclusão. Só o médico examinador deste
            exame, pela conta vinculada a ele, confirma. O registro original é preservado,
            e a descrição da restrição fica fora do ASO.
          </p>
          {!conclusions.ok ? (
            <SectionLoadError
              what="as confirmações do examinador"
              retryHref={retryHref}
            />
          ) : null}
          {conclusionRows.length ? (
            <ul className="text-text-subtle list-disc pl-5">
              {conclusionRows.map((row) => (
                <li key={row.id}>
                  {row.conclusion === "fit" ? "Apto" : "Inapto"} para a função ·
                  confirmado em {formatInstantDate(row.confirmedAt)}
                </li>
              ))}
            </ul>
          ) : null}
          {has("aptitude_confirmation_required") ? (
            <ExaminerConclusionForm examId={id} />
          ) : null}
        </section>
      ) : null}
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">Exames realizados</h2>
        <ul className="text-text-subtle flex flex-col gap-1">
          <li>Exame clínico — {exam.data.performedAt}</li>
          {!procedures.ok ? (
            <li>
              <SectionLoadError what="os exames complementares" retryHref={retryHref} />
            </li>
          ) : null}
          {procedureRows.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span>
                {p.procedureCode} {procedureLabel(p.procedureCode, p.otherDescription)} —{" "}
                {p.performedAt}
              </span>
              <RemoveProcedureButton examId={id} procedureId={p.id} />
            </li>
          ))}
        </ul>
        <ProcedureForm examId={id} />
      </section>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        {blocking.length ? (
          <p role="status" className="text-amber-900">
            A prévia não pode ser gerada: {blocking.length} pendência(s) na conferência.
          </p>
        ) : (
          <GenerateAsoButton examId={id} />
        )}
        {!docs.ok ? <SectionLoadError what="as prévias" retryHref={retryHref} /> : null}
        <p className="text-text-subtle text-xs">
          A prévia não é o ASO oficial. O sistema não assina: o ASO oficial é o documento
          assinado pelo médico examinador, registrado abaixo.
        </p>
      </section>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">
          ASO assinado (documento oficial)
        </h2>
        <p className="text-text-subtle">
          O ASO oficial é o PDF assinado pelo médico examinador (NR-7 7.5.19.1 g). O
          sistema guarda o arquivo íntegro (SHA-256), o método de assinatura e a
          conferência feita; ele não assina e não declara assinatura que não foi
          conferida. Correções substituem o documento vigente, com motivo, e o anterior é
          preservado.
        </p>
        {currentSigned?.outdated ? (
          <p className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-900">
            {ASO_SIGNED_OUTDATED_MESSAGE}
          </p>
        ) : null}
        {!signedDocs.ok ? (
          <SectionLoadError what="os ASOs assinados" retryHref={retryHref} />
        ) : signedRows.length ? (
          <ul className="flex flex-col gap-2">
            {signedRows.map((doc) => (
              <li key={doc.id} className="text-text-subtle flex flex-col gap-1">
                <span className="text-text font-semibold">
                  {doc.id === currentSigned?.id ? "Vigente" : "Substituído"} ·{" "}
                  {ASO_SIGNED_CONCLUSION_LABELS[doc.conclusion]} · assinado em{" "}
                  {doc.signedOn}
                </span>
                <span>
                  {ASO_SIGNED_ORIGIN_LABELS[doc.origin]} ·{" "}
                  {ASO_SIGNATURE_METHOD_LABELS[doc.signatureMethod]} · {doc.signerName} ·
                  CRM {doc.signerRegistration}/{doc.signerUf}
                </span>
                <span>Conferência: {doc.verificationReference}</span>
                {doc.replaceReason ? <span>Motivo: {doc.replaceReason}</span> : null}
                <span className="text-xs">
                  SHA-256 {doc.fileSha256.slice(0, 16)}… · registrado em{" "}
                  {formatInstantDate(doc.registeredAt)}{" "}
                  <DownloadSignedAsoButton id={doc.id} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-amber-900">
            Nenhum ASO assinado registrado. Até lá, o exame não tem ASO oficial.
          </p>
        )}
        {signedDocs.ok && docs.ok ? (
          <SignedAsoForm
            examId={id}
            previews={docRows
              .slice(0, 1)
              .map((doc) => ({ id: doc.id, version: doc.version }))}
            currentId={currentSigned?.id ?? null}
          />
        ) : null}
      </section>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">
          Entrega ao trabalhador (NR-7 7.5.19)
        </h2>
        <p className="text-text-subtle">
          O ASO assinado vigente precisa ser disponibilizado ao trabalhador, com
          comprovação, e fornecido em meio físico quando ele pedir. Sem comprovante, a
          entrega fica só registrada. Comprovante anexado aguarda a conferência de uma
          pessoa autorizada; só o recibo assinado pelo trabalhador na presença do revisor
          confirma o recebimento. A entrega vale para o documento entregue: se o ASO for
          substituído, a nova versão precisa de nova entrega.
        </p>
        {!signedDocs.ok || !deliveries.ok ? (
          <SectionLoadError
            what={!deliveries.ok ? "as entregas" : "os ASOs assinados"}
            retryHref={retryHref}
          />
        ) : currentSigned && deliveryData ? (
          <>
            <p className="text-text font-semibold">
              {ASO_DELIVERY_STATE_LABELS[deliveryData.summary.state]}
            </p>
            {deliveryData.summary.previousVersionDelivered ? (
              <p className="text-amber-900">
                A versão anterior do ASO foi entregue, mas foi substituída: entregue a
                versão vigente.
              </p>
            ) : null}
            {deliveryData.summary.physicalCopyPending ? (
              <p className="text-amber-900">
                O trabalhador pediu a via física, e ela ainda não foi registrada como
                entregue.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-amber-900">
            Registre o ASO assinado antes: a prévia não é entregue como ASO.
          </p>
        )}
        {deliveryData?.deliveries.length ? (
          <ul className="flex flex-col gap-2">
            {deliveryData.deliveries.map((d) => (
              <li key={d.id} className="text-text-subtle flex flex-col gap-1">
                <span className="text-text font-semibold">
                  {d.kind === "voided"
                    ? "Correção de registro"
                    : d.kind === "evidence_reviewed"
                      ? `Conferência do comprovante: ${ASO_EVIDENCE_REVIEW_RESULT_LABELS[d.reviewResult!]}`
                      : d.kind === "physical_copy_requested"
                        ? "Pedido de via física"
                        : ASO_DELIVERY_METHOD_LABELS[d.method!]}{" "}
                  ·{" "}
                  {new Date(d.occurredAt).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                  {d.signedDocumentId !== currentSigned?.id
                    ? " · versão substituída"
                    : ""}
                  {voidedIds.has(d.id) ? " · corrigido" : ""}
                </span>
                {d.channelDescription ? <span>Canal: {d.channelDescription}</span> : null}
                {d.evidenceReference ? (
                  <span>Evidência: {d.evidenceReference}</span>
                ) : null}
                {d.voidReason ? <span>Motivo: {d.voidReason}</span> : null}
                {d.kind === "evidence_reviewed" ? (
                  <span>
                    {ASO_EVIDENCE_REVIEW_METHOD_LABELS[d.reviewMethod!]} ·{" "}
                    {d.reviewReference} · revisor {d.recordedBy}
                  </span>
                ) : null}
                {d.hasEvidence && d.evidenceKind ? (
                  <span className="text-xs">
                    {ASO_DELIVERY_EVIDENCE_LABELS[d.evidenceKind]} · SHA-256{" "}
                    {d.evidenceSha256?.slice(0, 16)}…{" "}
                    <AsoDeliveryEvidenceButton id={d.id} />
                  </span>
                ) : null}
                {d.hasEvidence &&
                d.evidenceKind &&
                !voidedIds.has(d.id) &&
                !reviewedIds.has(d.id) &&
                d.signedDocumentId === currentSigned?.id ? (
                  <span className="flex flex-col gap-1">
                    <span className="text-amber-900">
                      Comprovante aguardando conferência.
                    </span>
                    <ReviewAsoEvidenceForm
                      examId={id}
                      deliveryId={d.id}
                      signedReceipt={d.evidenceKind === "signed_receipt"}
                    />
                  </span>
                ) : null}
                {d.kind !== "voided" && !voidedIds.has(d.id) ? (
                  <VoidAsoDeliveryForm examId={id} deliveryId={d.id} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {currentSigned && deliveryData ? <AsoDeliveryForm examId={id} /> : null}
      </section>
      {latest && !latest.ok ? (
        <SectionLoadError what="a última prévia" retryHref={retryHref} />
      ) : null}
      {latest?.ok ? (
        <Preview
          content={latest.data.content as AsoContent}
          version={latest.data.version}
          hash={latest.data.contentSha256}
        />
      ) : null}
      {docRows.length ? (
        <section className="glass-card flex flex-col gap-2 rounded-xl p-5">
          <h2 className="text-text text-base font-semibold">Versões arquivadas</h2>
          <ul className="text-text-subtle list-disc pl-5 text-sm">
            {docRows.map((doc) => (
              <li key={doc.id}>
                Versão {doc.version} · prévia · gerada em{" "}
                {formatInstantDate(doc.generatedAt)} · SHA-256{" "}
                {doc.contentSha256.slice(0, 12)}…
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
