import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  getEmployeeAction,
  listEmployeesAction,
} from "@/shared/server/actions/pgr/employees";
import { listMedicoOptionsAction } from "@/shared/server/actions/pgr/medicos";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";

import { PageHeader, PrimaryLink } from "../../../_ui/list";
import { HealthExamForm } from "../../_components/health-exam-form";
import { HealthExamIcon } from "../../_components/health-exam-icon";

export const dynamic = "force-dynamic";

export default async function EditHealthExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const [examResult, employeesResult, doctorsResult] = await Promise.all([
    getHealthExamAction(id),
    listEmployeesAction({ pageSize: 200, module: "medicine" }),
    listMedicoOptionsAction(),
  ]);
  if (!examResult.ok) notFound();
  const exam = examResult.data;
  const employees = employeesResult.ok
    ? employeesResult.data.rows.map((e) => ({
        id: e.id,
        fullName: `${e.fullName} — ${e.companyName}`,
      }))
    : [];
  const doctors = doctorsResult.ok ? doctorsResult.data : [];
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
          notes: exam.notes,
          certificatePath: exam.certificatePath,
        }}
      />
    </div>
  );
}
