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

const STATUS_FILTER = [
  { value: "", label: "Todos os status" },
  { value: "active", label: "Ativos" },
  { value: "on_leave", label: "Afastados" },
  { value: "dismissed", label: "Desligados" },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  on_leave: "Afastado",
  dismissed: "Desligado",
};

const STATUS_TONE: Record<string, StatusTone> = {
  active: "green",
  on_leave: "amber",
  dismissed: "red",
};

const TEMPLATE = "2fr 1.4fr 1.4fr 1.2fr 100px 84px";

const filterInput =
  "text-text h-11 rounded-xl border border-white/70 bg-white/50 px-3.5 text-[13px] outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-ring";

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

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<EmployeeIcon />}
        title="Funcionários"
        description="Pessoas vinculadas às empresas-cliente"
      />

      <ListCard>
        <ListToolbar>
          <form
            action="/employees"
            method="get"
            className="flex flex-1 flex-wrap items-center gap-2.5"
          >
            <input
              name="search"
              defaultValue={sp.search ?? ""}
              placeholder="Buscar por nome, GES ou função…"
              className={`${filterInput} min-w-[200px] flex-1`}
            />
            <select
              name="companyId"
              defaultValue={sp.companyId ?? ""}
              className={`${filterInput} font-semibold`}
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
              className={`${filterInput} font-semibold`}
            >
              {STATUS_FILTER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-text-muted hover:text-text h-11 rounded-xl border border-white/70 bg-white/50 px-4 text-[13px] font-semibold transition-colors"
            >
              Filtrar
            </button>
          </form>
          <ToolbarButton href="/employees/new">Novo Funcionário</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Nenhum funcionário encontrado." />
          </div>
        ) : (
          <>
            <DataGrid minWidth={940}>
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
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell>
                    <span className="flex items-center gap-3">
                      <AvatarBadge name={row.fullName} />
                      <a
                        href={`/employees/${row.id}`}
                        className="text-text font-semibold hover:underline"
                      >
                        {row.fullName}
                      </a>
                    </span>
                  </Cell>
                  <Cell>{row.gesName ?? "—"}</Cell>
                  <Cell>{row.companyName}</Cell>
                  <Cell className="text-text-subtle">—</Cell>
                  <Cell>
                    <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/employees/${row.id}/edit`} />
                      <DeleteEmployee id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
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
