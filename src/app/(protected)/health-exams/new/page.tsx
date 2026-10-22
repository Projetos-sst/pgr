import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { moduleIsEnabled } from "@/shared/domains/platform/company-modules";
import { getCompanyModuleOverviewAction } from "@/shared/server/actions/platform/company-modules";
import {
  getEmployeeAction,
  listEmployeesAction,
} from "@/shared/server/actions/pgr/employees";
import { listMedicoOptionsAction } from "@/shared/server/actions/pgr/medicos";

import { PageHeader } from "../../_ui/list";
import { ListErrorState, hrefWithParams } from "../../_ui/list-error-state";
import { HealthExamForm } from "../_components/health-exam-form";
import { HealthExamIcon } from "../_components/health-exam-icon";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ employeeId?: string }>;

export default async function NewHealthExamPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const requestedEmployeeId = sp.employeeId?.trim() || undefined;

  // Vindo da ficha: o funcionário precisa ser do tenant (senão 404). O retorno é
  // montado AQUI só com o id carregado — nunca uma URL de retorno lida da query.
  const employeeResult = requestedEmployeeId
    ? await getEmployeeAction(requestedEmployeeId)
    : null;
  if (employeeResult && !employeeResult.ok) notFound();
  const employee = employeeResult?.ok ? employeeResult.data : null;
  const returnTo = employee ? `/employees/${employee.id}` : undefined;
  const retryHref = hrefWithParams("/health-exams/new", { employeeId: employee?.id });

  const [employeesResult, doctorsResult, moduleResult] = await Promise.all([
    listEmployeesAction({
      pageSize: 200,
      module: "medicine",
      companyId: employee?.companyId,
    }),
    listMedicoOptionsAction(),
    employee
      ? getCompanyModuleOverviewAction(employee.companyId, { pageSize: 1 })
      : Promise.resolve(null),
  ]);

  // O nome só aparece depois de confirmada a Medicina na empresa do funcionário.
  const medicineConfirmed =
    !!moduleResult?.ok && moduleIsEnabled(moduleResult.data.modules, "medicine");

  const header = (
    <PageHeader
      backHref={returnTo ?? "/health-exams"}
      icon={<HealthExamIcon />}
      title="Novo exame"
      description={
        employee && medicineConfirmed
          ? `Exame ocupacional (ASO) de ${employee.fullName}`
          : "Exame ocupacional (ASO) de um funcionário"
      }
    />
  );

  function renderBody() {
    if (moduleResult && !moduleResult.ok) {
      return (
        <ListErrorState
          code={moduleResult.error.code}
          title="Não foi possível verificar se a Medicina está habilitada"
          description="Sem essa verificação o exame não pode ser registrado. Tente novamente."
          retryHref={retryHref}
        />
      );
    }
    if (moduleResult && !moduleIsEnabled(moduleResult.data.modules, "medicine")) {
      return (
        <ListErrorState
          code="FORBIDDEN"
          title="Medicina não habilitada para a empresa deste funcionário"
          description="Exames só podem ser registrados para funcionários de empresas com a Medicina do Trabalho habilitada (Empresas → Serviços)."
        />
      );
    }
    if (!employeesResult.ok) {
      return (
        <ListErrorState
          code={employeesResult.error.code}
          title="Não foi possível carregar os funcionários"
          description="O formulário precisa da lista de funcionários. Tente novamente."
          retryHref={retryHref}
        />
      );
    }
    if (!doctorsResult.ok) {
      return (
        <ListErrorState
          code={doctorsResult.error.code}
          title="Não foi possível carregar os médicos"
          description="O formulário precisa da lista de médicos. Tente novamente."
          retryHref={retryHref}
        />
      );
    }

    const employees = employeesResult.data.rows.map((e) => ({
      id: e.id,
      fullName: `${e.fullName} — ${e.companyName}`,
    }));
    // A lista tem teto de 200; o funcionário pré-selecionado (já validado no
    // tenant e com Medicina habilitada) entra mesmo se ficar além do teto.
    if (employee && !employees.some((e) => e.id === employee.id)) {
      employees.unshift({ id: employee.id, fullName: employee.fullName });
    }

    return (
      <HealthExamForm
        employees={employees}
        doctors={doctorsResult.data}
        defaultEmployeeId={employee?.id}
        returnTo={returnTo}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      {header}
      {renderBody()}
    </div>
  );
}
