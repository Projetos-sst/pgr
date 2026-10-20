import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import { listMedicoOptionsAction } from "@/shared/server/actions/pgr/medicos";

import { PageHeader } from "../../_ui/list";
import { HealthExamForm } from "../_components/health-exam-form";
import { HealthExamIcon } from "../_components/health-exam-icon";

export const dynamic = "force-dynamic";

export default async function NewHealthExamPage() {
  await requireOfficeStaffPage();
  const [employeesResult, doctorsResult] = await Promise.all([
    listEmployeesAction({ pageSize: 200, module: "medicine" }),
    listMedicoOptionsAction(),
  ]);
  const employees = employeesResult.ok
    ? employeesResult.data.rows.map((e) => ({
        id: e.id,
        fullName: `${e.fullName} — ${e.companyName}`,
      }))
    : [];
  const doctors = doctorsResult.ok ? doctorsResult.data : [];

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/health-exams"
        icon={<HealthExamIcon />}
        title="Novo exame"
        description="Exame ocupacional (ASO) de um funcionário"
      />
      <HealthExamForm employees={employees} doctors={doctors} />
    </div>
  );
}
