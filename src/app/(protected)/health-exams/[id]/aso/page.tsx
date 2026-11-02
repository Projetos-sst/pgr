import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { procedureLabel, type AsoContent } from "@/shared/domains/medicine/aso";
import { EXAM_TYPE_LABELS } from "@/shared/domains/pgr/health-exams";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  getAsoDocumentAction,
  getAsoReadinessAction,
  listAsoDocumentsAction,
  listExamProceduresAction,
} from "@/shared/server/actions/medicine/aso";

import { PageHeader } from "../../../_ui/list";
import { GenerateAsoButton, ProcedureForm, RemoveProcedureButton } from "./aso-controls";

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
          <dt className="text-text font-semibold">e) Conclusão</dt>
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
 * ASO do exame (NOB-152): conferência da NR-7 7.5.19.1, exames complementares realizados e
 * prévias arquivadas. Não há emissão oficial nem assinatura: dependem de assinatura verificável
 * do examinador (MED-12). Observações clínicas do exame nunca aparecem aqui.
 */
export default async function AsoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const exam = await getHealthExamAction(id);
  if (!exam.ok) notFound();
  const [readiness, procedures, docs] = await Promise.all([
    getAsoReadinessAction(id),
    listExamProceduresAction(id),
    listAsoDocumentsAction(id),
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
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">Exames realizados</h2>
        <ul className="text-text-subtle flex flex-col gap-1">
          <li>Exame clínico — {exam.data.performedAt}</li>
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
        <p className="text-text-subtle text-xs">
          Emissão do ASO e assinatura do médico examinador ainda não estão disponíveis no
          sistema.
        </p>
      </section>
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
                {new Date(doc.generatedAt).toISOString().slice(0, 10)} · SHA-256{" "}
                {doc.contentSha256.slice(0, 12)}…
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
