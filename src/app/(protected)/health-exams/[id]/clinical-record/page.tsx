import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDate } from "@/shared/dates";
import {
  CLINICAL_ACCESS_BASIS_LABELS,
  CLINICAL_NOTE_ORIGIN_LABELS,
} from "@/shared/domains/medicine/clinical-record";
import { EXAM_TYPE_LABELS } from "@/shared/domains/pgr/health-exams";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  listWorkRestrictionsAction,
  readClinicalRecordAction,
} from "@/shared/server/actions/medicine/clinical-record";

import { PageHeader } from "../../../_ui/list";
import { SectionLoadError } from "../../../_ui/section-load-error";
import { ClinicalNoteForm, WorkRestrictionForm } from "./clinical-record-controls";

export const dynamic = "force-dynamic";

/**
 * Prontuário segregado do exame (NOB-155, DT-21). Só a conta vinculada ao médico examinador ou ao
 * coordenador do PCMSO da empresa abre; cada abertura fica na trilha de acesso. Owner e
 * colaborador veem o aviso de acesso restrito, sem nenhum conteúdo.
 */
export default async function ClinicalRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const exam = await getHealthExamAction(id);
  if (!exam.ok) notFound();
  const header = (
    <PageHeader
      title={`Prontuário — ${EXAM_TYPE_LABELS[exam.data.examType]} de ${exam.data.performedAt}`}
      backHref={`/health-exams/${id}/edit`}
      description="Observações clínicas do exame, separadas do cadastro e visíveis só ao médico examinador e ao coordenador do PCMSO."
    />
  );
  const record = await readClinicalRecordAction(id);
  if (!record.ok) {
    return (
      <div className="mx-auto flex w-full max-w-[940px] flex-col gap-6 px-6 py-8">
        {header}
        <p role="alert" className="glass-card rounded-xl p-5 text-sm text-amber-900">
          {record.error.code === "FORBIDDEN"
            ? "Acesso restrito: o prontuário clínico é aberto só pela conta vinculada ao médico examinador deste exame ou ao coordenador do PCMSO da empresa."
            : record.error.message}
        </p>
      </div>
    );
  }
  const restrictions = await listWorkRestrictionsAction(id);
  const restrictionRows = restrictions.ok ? restrictions.data : [];
  const current = restrictionRows[0];

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-6 px-6 py-8">
      {header}
      <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Acesso como {CLINICAL_ACCESS_BASIS_LABELS[record.data.basis].toLowerCase()}. Esta
        leitura fica registrada na trilha de acesso, sem o conteúdo.
      </p>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">Observações clínicas</h2>
        {record.data.notes.length ? (
          <ul className="flex flex-col gap-3">
            {record.data.notes.map((note) => (
              <li key={note.id} className="border-border rounded-lg border p-3">
                <p className="text-text-subtle text-xs">
                  {formatInstantDate(note.recordedAt)} ·{" "}
                  {CLINICAL_NOTE_ORIGIN_LABELS[note.origin]}
                  {note.authorName
                    ? ` · ${note.authorName} (${note.authorRegistration})`
                    : ""}
                </p>
                <p className="text-text mt-1 whitespace-pre-wrap">{note.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-subtle">Nenhuma observação clínica registrada.</p>
        )}
        <ClinicalNoteForm examId={id} />
      </section>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">
          Restrição necessária ao trabalho (comunicação ao RH)
        </h2>
        <p className="text-text-subtle">
          É o único texto do médico que o RH lê. Fica fora do ASO e não leva diagnóstico.
        </p>
        {!restrictions.ok ? (
          <SectionLoadError
            what="as restrições comunicadas"
            retryHref={`/health-exams/${id}/clinical-record`}
          />
        ) : current ? (
          <p role="status">
            Vigente:{" "}
            {current.kind === "restriction"
              ? current.restriction
              : "sem restrições (retiradas)"}{" "}
            · {formatInstantDate(current.recordedAt)}
          </p>
        ) : (
          <p className="text-text-subtle">Nenhuma restrição comunicada.</p>
        )}
        {restrictions.ok ? (
          <WorkRestrictionForm examId={id} hasCurrent={current?.kind === "restriction"} />
        ) : null}
      </section>
    </div>
  );
}
