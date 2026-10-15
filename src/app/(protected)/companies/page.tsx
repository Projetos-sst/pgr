import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  formatCnpj,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_TONE,
} from "@/shared/domains/pgr/companies";
import { resolvePageParams } from "@/shared/pagination";
import { listCompaniesAction } from "@/shared/server/actions/pgr/companies";

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
  ToolbarSearch,
  ToolbarSelect,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { CompanyIcon } from "./_components/company-icon";
import { DeleteCompany } from "./_components/delete-company";

export const dynamic = "force-dynamic";

const TEMPLATE = "2.2fr 1.4fr 1.3fr 0.9fr 0.7fr 100px 84px";

// UFs brasileiras — opções do filtro "Todos os Estados" (#188).
const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
].map((uf) => ({ value: uf, label: uf }));

type SearchParams = Promise<{ search?: string; state?: string; page?: string }>;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listCompaniesAction({
    search: sp.search,
    state: sp.state,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<CompanyIcon />}
        title="Empresas"
        description={`Empresas-cliente do escritório — ${total} cadastrada(s)`}
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/companies"
            placeholder="Buscar por razão social ou CNPJ…"
            defaultValue={sp.search}
            hidden={{ state: sp.state }}
          />
          <ToolbarSelect
            basePath="/companies"
            name="state"
            defaultValue={sp.state}
            options={UF_OPTIONS}
            emptyLabel="Todos os Estados"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href="/companies/new">Nova Empresa</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search || sp.state
                  ? "Nenhuma empresa encontrada para os filtros."
                  : "Nenhuma empresa cadastrada."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={960}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Razão Social" },
                  { header: "CNPJ" },
                  { header: "Cidade / UF" },
                  { header: "Funcion." },
                  { header: "GES" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell>
                    <span className="flex items-center gap-3">
                      <AvatarBadge name={row.razaoSocial} />
                      <span className="text-text font-semibold">{row.razaoSocial}</span>
                    </span>
                  </Cell>
                  <Cell className="text-text-muted">{formatCnpj(row.cnpj)}</Cell>
                  <Cell>{[row.city, row.state].filter(Boolean).join(" / ") || "—"}</Cell>
                  <Cell className={row.employeeCount ? undefined : "text-text-subtle"}>
                    {row.employeeCount}
                  </Cell>
                  <Cell className={row.gesCount ? undefined : "text-text-subtle"}>
                    {row.gesCount}
                  </Cell>
                  <Cell>
                    <StatusBadge tone={COMPANY_STATUS_TONE[row.status]}>
                      {COMPANY_STATUS_LABELS[row.status]}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/companies/${row.id}/edit`} />
                      <DeleteCompany id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/companies"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, state: sp.state }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
