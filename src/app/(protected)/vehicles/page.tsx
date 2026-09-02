import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import {
  formatPlate,
  type VehicleInspectionStatus,
} from "@/shared/domains/inspections/vehicles";
import {
  listVehicleCompanyOptionsAction,
  listVehiclesAction,
} from "@/shared/server/actions/inspections/vehicles";

import { EmptyState, PageHeader } from "../_ui/list";
import {
  Cell,
  DataGrid,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  MonoCell,
  StatusBadge,
  ToolbarButton,
  ToolbarSearch,
  ToolbarSelect,
  ViewIcon,
  type StatusTone,
} from "../_ui/data-list";
import { DeleteVehicle } from "./_components/delete-vehicle";
import { VehicleIcon } from "./_components/vehicle-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1fr 1.8fr 1.2fr 1fr 1.2fr 1.1fr 84px";

// Status de inspeção (derivado): Regular verde, A vencer âmbar, Vencida vermelho.
const STATUS_TONE: Record<VehicleInspectionStatus, StatusTone> = {
  none: "neutral",
  regular: "green",
  due_soon: "amber",
  expired: "red",
};

function formatDate(iso: string | null): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR") : "—";
}

type SearchParams = Promise<{ search?: string; company?: string; page?: string }>;

export default async function VeiculosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const [result, companyOptions] = await Promise.all([
    listVehiclesAction({ search: sp.search, companyId: sp.company, page }),
    listVehicleCompanyOptionsAction(),
  ]);
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const companies = companyOptions.ok ? companyOptions.data : [];
  const params = { search: sp.search, company: sp.company };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<VehicleIcon />}
        title="Veículos"
        description="Frota cadastrada para inspeções veiculares e OS"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/vehicles"
            placeholder="Buscar por placa ou modelo…"
            defaultValue={sp.search}
            hidden={{ company: sp.company }}
          />
          <ToolbarSelect
            basePath="/vehicles"
            name="company"
            defaultValue={sp.company}
            options={companies}
            emptyLabel="Todas as Empresas"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href="/vehicles/new">Novo Veículo</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search || sp.company
                  ? "Nenhum veículo encontrado para o filtro."
                  : "Nenhum veículo cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={900}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Placa" },
                  { header: "Veículo" },
                  { header: "Tipo" },
                  { header: "Empresa" },
                  { header: "Últ. Inspeção" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/vehicles/${row.id}/edit`}>
                    {formatPlate(row.plate)}
                  </MonoCell>
                  <Cell className="text-text font-semibold">
                    {[row.brand, row.model].filter(Boolean).join(" ") || "—"}
                  </Cell>
                  <Cell>{row.typeLabel}</Cell>
                  <Cell>{row.companyName ?? "—"}</Cell>
                  <Cell className="text-text-muted font-mono">
                    {formatDate(row.lastInspectedAt)}
                  </Cell>
                  <Cell>
                    <StatusBadge tone={STATUS_TONE[row.inspectionStatus]}>
                      {row.inspectionStatusLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <span className="flex items-center justify-end gap-1">
                      <a
                        href={`/vehicles/${row.id}/edit`}
                        aria-label="Ver/editar veículo"
                        title="Ver/editar"
                        className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
                      >
                        <ViewIcon />
                      </a>
                      <DeleteVehicle id={row.id} />
                    </span>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/vehicles"
              page={page}
              pageSize={pageSize}
              total={total}
              params={params}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
