import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { ABSENCE_CAUSE_LABELS } from "@/shared/domains/medicine/absences";
import {
  getAbsenceAction,
  readAbsenceClinicalNotesAction,
} from "@/shared/server/actions/medicine/absences";

import { PageHeader } from "../../../_ui/list";
import { AbsenceClinicalNoteForm } from "./clinical-note-form";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * Área clínica do afastamento (NOB-139, MED-17): atestado e CID, só para a conta vinculada ao
 * coordenador do PCMSO da empresa. Cada abertura fica na trilha de acesso, sem o conteúdo. Owner,
 * colaborador e RH veem só o aviso de acesso restrito.
 */
export default async function AbsenceClinicalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const absence = await getAbsenceAction(id);
  if (!absence.ok) notFound();
  const header = (
    <PageHeader
      title={`Área clínica do afastamento — ${ABSENCE_CAUSE_LABELS[absence.data.cause]} desde ${fmt(absence.data.startsOn)}`}
      backHref={`/employees/${absence.data.employeeId}`}
      description="Atestado e CID do afastamento, separados do registro administrativo e visíveis só ao coordenador do PCMSO."
    />
  );
  const notes = await readAbsenceClinicalNotesAction(id);
  if (!notes.ok)
    return (
      <div className="mx-auto flex w-full max-w-[940px] flex-col gap-6 px-6 py-8">
        {header}
        <p role="alert" className="glass-card rounded-xl p-5 text-sm text-amber-900">
          {notes.error.code === "FORBIDDEN"
            ? "Acesso restrito: a área clínica do afastamento é aberta só pela conta vinculada ao médico coordenador do PCMSO da empresa."
            : notes.error.message}
        </p>
      </div>
    );
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-6 px-6 py-8">
      {header}
      <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Esta leitura fica registrada na trilha de acesso, sem o conteúdo. O CID só é
        registrado com a autorização do trabalhador, e nada daqui aparece para o RH ou no
        ASO.
      </p>
      <section className="glass-card flex flex-col gap-3 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">Registros clínicos</h2>
        {notes.data.length ? (
          <ul className="flex flex-col gap-3">
            {notes.data.map((n) => (
              <li key={n.id} className="border-border rounded-lg border p-3">
                <p className="text-text-subtle text-xs">
                  {fmt(n.recordedAt)}
                  {n.authorName ? ` · ${n.authorName}` : ""}
                </p>
                {n.cid ? (
                  <p>
                    CID {n.cid} (autorização: {n.workerAuthorization})
                  </p>
                ) : null}
                {n.content ? <p className="whitespace-pre-wrap">{n.content}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-subtle">Nenhum registro clínico.</p>
        )}
        <AbsenceClinicalNoteForm absenceId={id} />
      </section>
    </div>
  );
}
