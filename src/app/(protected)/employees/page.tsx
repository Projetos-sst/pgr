import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import {
  AvatarBadge,
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  RowActions,
  StatusBadge,
  ToolbarButton,
  type StatusTone,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { DeleteEmployee } from "./_components/delete-employee";
import { EmployeeIcon } from "./_components/employee-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "2fr 1.5fr 1.5fr 1.2fr 1fr 84px";

const STATUS_FILTER = [
  { value: "", label: "Todos os status" },
  { value: "active", label: "Ativos" },
  { value: "on_leave", label: "Afastados" },
  { value: "dismissed", label: "Desligados" },
];

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Ativo", tone: "green" },
  on_leave: { label: "Afastado", tone: "amber" },
  dismissed: { label: "Desligado", tone: "neutral" },
};

type SearchParams = Promise<{
  search?: string;
  page?: string;
  companyId?: string;
  status?: string;
}>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const [listResult, companiesResult] = await Promise.all([
    listEmployeesAction({
      search: sp.search,
      companyId: sp.companyId,
      status: sp.status,
      page,
    }),
    listCompanyOptionsAction(),
  ]);
  const { rows, total } = listResult.ok ? listResult.data : { rows: [], total: 0 };
  const companies = companiesResult.ok ? companiesResult.data : [];

  const filterFieldClass =
    "text-text-muted h-11 rounded-xl border border-white/70 bg-white/50 px-4 text-[13px] font-semibold outline-none";

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<EmployeeIcon />}
        title="Funcionários"
        description={`Pessoas vinculadas às empresas-cliente — ${total} colaborador(es)`}
      />

      <ListCard>
        <ListToolbar>
          <form
            action="/employees"
            method="get"
            className="flex flex-1 flex-wrap items-center gap-3.5"
          >
            <div className="focus-within:border-primary focus-within:ring-primary-ring flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-white/70 bg-white/50 px-4 focus-within:ring-[3px]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9095ad"
                strokeWidth="1.9"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
              <input
                name="search"
                defaultValue={sp.search ?? ""}
                placeholder="Buscar por nome, GES ou função…"
                className="text-text placeholder:text-text-subtle w-full bg-transparent text-[13px] outline-none"
              />
            </div>
            <select
              name="companyId"
              defaultValue={sp.companyId ?? ""}
              className={filterFieldClass}
            >
              <option value="">Todas as empresas</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razaoSocial}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className={filterFieldClass}
            >
              {STATUS_FILTER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="glass-panel text-text-muted hover:text-text h-11 rounded-xl px-[18px] text-[13px] font-bold transition-colors"
            >
              Filtrar
            </button>
          </form>
          <ToolbarButton href="/employees/new">Novo funcionário</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Nenhum funcionário encontrado." />
          </div>
        ) : (
          <>
            <DataGrid minWidth={900}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Nome" },
                  { header: "GES / Obra" },
                  { header: "Empresa" },
                  { header: "Ordens de Serviço" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => {
                const meta = STATUS_META[row.status] ?? {
                  label: row.status,
                  tone: "neutral" as StatusTone,
                };
                return (
                  <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                    <Cell>
                      <span className="flex items-center gap-3">
                        <AvatarBadge name={row.fullName} />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-text font-semibold">{row.fullName}</span>
                          {row.jobRoleTitle ? (
                            <span className="text-text-subtle text-[11px]">
                              {row.jobRoleTitle}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Cell>
                    <Cell className="text-text-muted">{row.gesName ?? "—"}</Cell>
                    <Cell className="text-text-muted">{row.companyName}</Cell>
                    <Cell
                      className={row.serviceOrderCount ? undefined : "text-text-subtle"}
                    >
                      {row.serviceOrderCount
                        ? `${row.serviceOrderCount} emitida(s)`
                        : "—"}
                    </Cell>
                    <Cell>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </Cell>
                    <Cell align="right">
                      <RowActions>
                        <EditIconLink href={`/employees/${row.id}`} />
                        <DeleteEmployee id={row.id} />
                      </RowActions>
                    </Cell>
                  </GridRow>
                );
              })}
            </DataGrid>
            <ListFooter
              basePath="/employees"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, companyId: sp.companyId, status: sp.status }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
