import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  serviceOrderStatusSchema,
  SERVICE_ORDER_STATUS_LABELS,
} from "@/shared/domains/safety/service-order";
import { resolvePageParams } from "@/shared/pagination";
import { listServiceOrdersAction } from "@/shared/server/actions/safety/service-orders";

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
  type StatusTone,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { DeleteServiceOrder } from "./_components/delete-service-order";
import { ServiceOrderIcon } from "./_components/service-order-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1.6fr 1.4fr 1.2fr 1fr 0.9fr 1.4fr 84px";

const STATUS_TONE: Record<string, StatusTone> = {
  open: "amber",
  in_progress: "indigo",
  completed: "green",
  cancelled: "red",
};

// "Dias aberta" como pílula colorida (espelha o mockup): quanto mais tempo em
// aberto, mais urgente — verde recente, âmbar intermediário, vermelho longo.
function daysOpenTone(days: number): StatusTone {
  if (days <= 10) return "green";
  if (days <= 20) return "amber";
  return "red";
}

type SearchParams = Promise<{ page?: string; search?: string; status?: string }>;

export default async function ServiceOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const parsedStatus = serviceOrderStatusSchema.safeParse(sp.status);
  const status = parsedStatus.success ? parsedStatus.data : undefined;

  const result = await listServiceOrdersAction({ page, q: sp.search, status });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const params = { search: sp.search, status: sp.status };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<ServiceOrderIcon />}
        title="Ordens de Serviço"
        description="Entrega de EPIs e instruções ao trabalhador, com checklist e número por escritório"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/service-orders"
            placeholder="Buscar por título ou número…"
            defaultValue={sp.search}
            hidden={{ status: sp.status }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/service-orders"
              className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                !sp.status
                  ? "btn-primary"
                  : "text-text-muted hover:text-text border border-white/70 bg-white/50"
              }`}
            >
              Todas
            </Link>
            {Object.entries(SERVICE_ORDER_STATUS_LABELS).map(([value, label]) => (
              <Link
                key={value}
                href={`/service-orders?status=${value}`}
                className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  sp.status === value
                    ? "btn-primary"
                    : "text-text-muted hover:text-text border border-white/70 bg-white/50"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <ToolbarButton href="/service-orders/new">Nova OS</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Nenhuma Ordem de Serviço encontrada." />
          </div>
        ) : (
          <>
            <DataGrid minWidth={1000}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Funcionário" },
                  { header: "OS" },
                  { header: "Tipo OS" },
                  { header: "Data Emissão" },
                  { header: "Dias Aberta" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell>
                    <span className="flex items-center gap-3">
                      <AvatarBadge name={row.employeeName ?? "?"} />
                      <span className="text-text font-semibold">
                        {row.employeeName ?? "—"}
                      </span>
                    </span>
                  </Cell>
                  <Cell className="text-primary font-mono font-semibold">
                    #{row.number}
                  </Cell>
                  <Cell>{row.title}</Cell>
                  <Cell className="text-text-muted font-mono">{row.openedAt}</Cell>
                  <Cell>
                    <StatusBadge tone={daysOpenTone(row.daysOpen)}>
                      {row.daysOpen} {row.daysOpen === 1 ? "dia" : "dias"}
                    </StatusBadge>
                  </Cell>
                  <Cell>
                    <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"}>
                      {row.statusLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/service-orders/${row.id}`} />
                      <DeleteServiceOrder id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/service-orders"
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
