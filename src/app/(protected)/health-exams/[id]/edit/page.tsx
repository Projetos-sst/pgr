import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import { listMedicoOptionsAction } from "@/shared/server/actions/pgr/medicos";
import { getHealthExamAction } from "@/shared/server/actions/pgr/health-exams";

import { PageHeader } from "../../../_ui/list";
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
    listEmployeesAction({ pageSize: 200 }),
    listMedicoOptionsAction(),
  ]);
  if (!examResult.ok) notFound();
  const exam = examResult.data;
  const employees = employeesResult.ok
    ? employeesResult.data.rows.map((e) => ({ id: e.id, fullName: e.fullName }))
    : [];
  const doctors = doctorsResult.ok ? doctorsResult.data : [];

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/health-exams"
        icon={<HealthExamIcon />}
        title="Editar exame"
        description="Exame ocupacional (ASO)"
      />
      <HealthExamForm
        id={exam.id}
        employees={employees}
        doctors={doctors}
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
