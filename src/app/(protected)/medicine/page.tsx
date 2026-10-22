import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import {
  getMedicineOverviewAction,
  listMedicineEmployeesAction,
} from "@/shared/server/actions/medicine/overview";

import { EmptyState, PageHeader } from "../_ui/list";
import { ListCard, ListToolbar, ToolbarButton } from "../_ui/data-list";
import { ListErrorState, hrefWithParams } from "../_ui/list-error-state";
import { HealthExamIcon } from "../health-exams/_components/health-exam-icon";
import { MedicineCompanyFilter } from "./_components/medicine-company-filter";
import { MedicineEmployeeList } from "./_components/medicine-employee-list";
import { MedicineEmptyState } from "./_components/medicine-empty-state";
import { MedicineOverviewCards } from "./_components/medicine-overview-cards";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ companyId?: string; search?: string; page?: string }>;

/** Mensagem da lista por código de erro do contrato (erro ≠ vazio). */
const EMPLOYEE_LIST_ERROR: Record<string, { title: string; description: string }> = {
  FORBIDDEN: {
    title: "Medicina não habilitada para esta empresa",
    description:
      "Os funcionários só aparecem em empresas com a Medicina do Trabalho habilitada.",
  },
  NOT_FOUND: {
    title: "Empresa não encontrada",
    description: "A empresa selecionada não existe neste escritório.",
  },
  VALIDATION: {
    title: "Filtro inválido",
    description: "Selecione novamente a empresa no filtro acima.",
  },
};

export default async function MedicinePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireOfficeStaffPage();
  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const requestedCompanyId = sp.companyId?.trim() || undefined;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const retryHref = hrefWithParams("/medicine", {
    companyId: requestedCompanyId,
    search,
    page: sp.page,
  });

  const header = (
    <PageHeader
      icon={<HealthExamIcon />}
      title="Medicina do Trabalho"
      description="Painel das empresas com Medicina habilitada"
      action={
        <div className="flex">
          <ToolbarButton href="/health-exams/new">Registrar exame</ToolbarButton>
        </div>
      }
    />
  );

  const overview = await getMedicineOverviewAction();

  if (!overview.ok) {
    return (
      <div className="flex flex-col gap-[22px] px-4 pt-8 pb-10 sm:px-[30px]">
        {header}
        <ListErrorState
          code={overview.error.code}
          title="Não foi possível carregar o painel da Medicina"
          description="Isso não significa que não haja dados. Tente novamente em instantes."
          retryHref={retryHref}
        />
      </div>
    );
  }

  const { companies, totals, today, dueWindowDays } = overview.data;

  if (companies.length === 0) {
    return (
      <div className="flex flex-col gap-[22px] px-4 pt-8 pb-10 sm:px-[30px]">
        {header}
        <MedicineEmptyState role={ctx.role} />
      </div>
    );
  }

  // A empresa da URL só vale se estiver no painel (do tenant e com Medicina); o
  // servidor revalida de qualquer forma. Com uma empresa só, ela já vem selecionada.
  const selected = requestedCompanyId
    ? companies.find((c) => c.companyId === requestedCompanyId)
    : companies.length === 1
      ? companies[0]
      : undefined;
  const isUnknownCompany = requestedCompanyId !== undefined && !selected;

  const employees = selected
    ? await listMedicineEmployeesAction({
        companyId: selected.companyId,
        search,
        page,
        pageSize,
      })
    : null;

  return (
    <div className="flex flex-col gap-[22px] px-4 pt-8 pb-10 sm:px-[30px]">
      {header}

      <section aria-labelledby="medicine-summary-title" className="flex flex-col gap-3">
        <h2
          id="medicine-summary-title"
          className="text-text-subtle font-mono text-[11px] tracking-[0.14em] uppercase"
        >
          {selected ? `Resumo · ${selected.companyName}` : "Resumo · todas as empresas"}
        </h2>
        <MedicineOverviewCards
          companies={totals.companies}
          employees={selected ? selected.employeeCount : totals.employees}
          validity={selected ? selected.validity : totals}
          dueWindowDays={dueWindowDays}
          companyName={selected?.companyName}
        />
      </section>

      <section aria-labelledby="medicine-employees-title">
        <h2 id="medicine-employees-title" className="sr-only">
          Funcionários e último exame
        </h2>
        <ListCard>
          <ListToolbar>
            <MedicineCompanyFilter
              companies={companies.map((c) => ({ id: c.companyId, name: c.companyName }))}
              companyId={selected?.companyId ?? requestedCompanyId}
              search={search}
            />
          </ListToolbar>

          {isUnknownCompany ? (
            <div className="p-6">
              <EmptyState
                isFlat
                title="Empresa inexistente ou sem Medicina habilitada"
                message="Selecione no filtro acima uma das empresas com Medicina do Trabalho habilitada."
              />
            </div>
          ) : !selected || !employees ? (
            <div className="p-6">
              <EmptyState
                isFlat
                title="Selecione uma empresa"
                message="Escolha uma empresa para ver os funcionários e a situação do último exame."
              />
            </div>
          ) : !employees.ok ? (
            <ListErrorState
              isFlat
              code={employees.error.code}
              title={
                EMPLOYEE_LIST_ERROR[employees.error.code]?.title ??
                "Não foi possível carregar os funcionários"
              }
              description={
                EMPLOYEE_LIST_ERROR[employees.error.code]?.description ??
                "Isso não significa que a empresa não tenha funcionários. Tente novamente."
              }
              retryHref={retryHref}
            />
          ) : (
            <MedicineEmployeeList
              rows={employees.data.rows}
              total={employees.data.total}
              page={page}
              pageSize={pageSize}
              companyId={selected.companyId}
              search={search}
              today={today}
              dueWindowDays={dueWindowDays}
            />
          )}
        </ListCard>
      </section>
    </div>
  );
}
