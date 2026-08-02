import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { formatCnpj } from "@/shared/domains/pgr/companies";
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
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { CompanyIcon } from "./_components/company-icon";
import { DeleteCompany } from "./_components/delete-company";

export const dynamic = "force-dynamic";

const TEMPLATE = "2.2fr 1.4fr 1.3fr 0.9fr 0.7fr 100px 84px";

type SearchParams = Promise<{ search?: string; page?: string }>;

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
  const result = await listCompaniesAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<CompanyIcon />}
        title="Empresas"
        description="Empresas-cliente do escritório — raiz da cadeia do PGR"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/companies"
            placeholder="Buscar por razão social ou CNPJ…"
            defaultValue={sp.search}
          />
          <ToolbarButton href="/companies/new">Nova Empresa</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search
                  ? "Nenhuma empresa encontrada para a busca."
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
                  <Cell className="text-text-subtle">—</Cell>
                  <Cell className="text-text-subtle">—</Cell>
                  <Cell>
                    <StatusBadge tone="green">Ativa</StatusBadge>
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
              params={{ search: sp.search }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
