import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatInstantDate } from "@/shared/dates";
import {
  CLINICAL_ACCESS_ACTION_LABELS,
  CLINICAL_ACCESS_BASIS_LABELS,
} from "@/shared/domains/medicine/clinical-record";
import {
  getEmployeeAction,
  listEmployeesAction,
} from "@/shared/server/actions/pgr/employees";
import {
  getMedicoAction,
  listMedicoOptionsAction,
} from "@/shared/server/actions/pgr/medicos";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";
import {
  getClinicalAccessAction,
  listClinicalAccessEventsAction,
  listWorkRestrictionsAction,
} from "@/shared/server/actions/medicine/clinical-record";

import { PageHeader, PrimaryLink } from "../../../_ui/list";
import { SectionLoadError } from "../../../_ui/section-load-error";
import { HealthExamForm } from "../../_components/health-exam-form";
import { HealthExamIcon } from "../../_components/health-exam-icon";

export const dynamic = "force-dynamic";

export default async function EditHealthExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await requireOfficeStaffPage();
  const { id } = await params;
  const [examResult, employeesResult, doctorsResult] = await Promise.all([
    getHealthExamAction(id),
    listEmployeesAction({ pageSize: 200, module: "medicine" }),
    listMedicoOptionsAction(),
  ]);
  if (!examResult.ok) notFound();
  const exam = examResult.data;
  // RH vê só a comunicação de restrição (sem diagnóstico); o prontuário é do médico vinculado.
  const [access, restrictions, accessEvents] = await Promise.all([
    getClinicalAccessAction(id),
    listWorkRestrictionsAction(id),
    role === "owner" ? listClinicalAccessEventsAction(id) : Promise.resolve(null),
  ]);
  const canOpenRecord = access.ok && access.data.allowed;
  const currentRestriction = restrictions.ok ? restrictions.data[0] : undefined;
  const eventRows = accessEvents?.ok ? accessEvents.data : [];
  const employees = employeesResult.ok
    ? employeesResult.data.rows.map((e) => ({
        id: e.id,
        fullName: `${e.fullName} — ${e.companyName}`,
      }))
    : [];
  const doctors = doctorsResult.ok ? [...doctorsResult.data] : [];
  // As opções trazem só médicos ativos. O médico gravado no exame (inativo, por exemplo) entra
  // como opção própria: sem ela, o select mostraria "sem médico" e salvar apagaria o examinador.
  if (exam.doctorId && !doctors.some((d) => d.id === exam.doctorId)) {
    const stored = await getMedicoAction(exam.doctorId);
    doctors.push(
      stored.ok
        ? {
            id: stored.data.id,
            name: stored.data.name,
            crm:
              stored.data.status === "inactive"
                ? `${stored.data.crm} (inativo)`
                : stored.data.crm,
          }
        : { id: exam.doctorId, name: "Médico registrado no exame", crm: "—" },
    );
  }
  // O funcionário do exame é fixo na edição; a lista tem teto de 200, então ele
  // é buscado direto quando não está nela (mesmo tenant, já validado pelo exame).
  let lockedEmployee = employees.find((e) => e.id === exam.employeeId);
  if (!lockedEmployee) {
    const employeeResult = await getEmployeeAction(exam.employeeId);
    lockedEmployee = {
      id: exam.employeeId,
      fullName: employeeResult.ok ? employeeResult.data.fullName : "Funcionário do exame",
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/health-exams"
        icon={<HealthExamIcon />}
        title="Editar exame"
        description="Exame ocupacional (ASO)"
        action={
          <PrimaryLink href={`/health-exams/${exam.id}/aso`}>
            Conferência do ASO
          </PrimaryLink>
        }
      />
      <HealthExamForm
        id={exam.id}
        employees={employees}
        doctors={doctors}
        lockedEmployee={lockedEmployee}
        initial={{
          employeeId: exam.employeeId,
          doctorId: exam.doctorId,
          examType: exam.examType,
          performedAt: exam.performedAt,
          validUntil: exam.validUntil,
          aptitude: exam.aptitude,
          certificatePath: exam.certificatePath,
        }}
      />
      <section className="glass-card flex flex-col gap-2 rounded-xl p-5 text-sm">
        <h2 className="text-text text-base font-semibold">
          Restrição necessária ao trabalho
        </h2>
        {!restrictions.ok ? (
          <SectionLoadError
            what="as restrições comunicadas"
            retryHref={`/health-exams/${exam.id}/edit`}
          />
        ) : currentRestriction?.kind === "restriction" ? (
          <p role="status">
            {currentRestriction.restriction} · comunicada em{" "}
            {formatInstantDate(currentRestriction.recordedAt)}
            {currentRestriction.authorName ? ` por ${currentRestriction.authorName}` : ""}
          </p>
        ) : (
          <p className="text-text-subtle">
            Nenhuma restrição vigente comunicada pelo médico.
          </p>
        )}
        <p className="text-text-subtle text-xs">
          Observações clínicas ficam no prontuário, aberto só pela conta vinculada ao
          médico examinador ou ao coordenador do PCMSO.
        </p>
        {canOpenRecord ? (
          <Link
            href={`/health-exams/${exam.id}/clinical-record`}
            className="text-primary self-start font-semibold underline"
          >
            Abrir prontuário clínico
          </Link>
        ) : null}
      </section>
      {role === "owner" ? (
        <section className="glass-card flex flex-col gap-2 rounded-xl p-5 text-sm">
          <h2 className="text-text text-base font-semibold">Acessos ao prontuário</h2>
          {accessEvents && !accessEvents.ok ? (
            <SectionLoadError
              what="os acessos ao prontuário"
              retryHref={`/health-exams/${exam.id}/edit`}
            />
          ) : eventRows.length ? (
            <ul className="text-text-subtle list-disc pl-5">
              {eventRows.map((event) => (
                <li key={event.id}>
                  {formatInstantDate(event.occurredAt)} ·{" "}
                  {CLINICAL_ACCESS_ACTION_LABELS[event.action]} ·{" "}
                  {event.medicoName ?? "Profissional"} (
                  {CLINICAL_ACCESS_BASIS_LABELS[event.basis].toLowerCase()})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-subtle">Nenhum acesso registrado.</p>
          )}
          <p className="text-text-subtle text-xs">
            A trilha mostra quem acessou e quando, nunca o conteúdo clínico.
          </p>
        </section>
      ) : null}
    </div>
  );
}
