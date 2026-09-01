import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { ServiceOrderSignatureState } from "@/shared/domains/safety/service-order-signature";
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

// "Dias aberta" como pílula colorida (espelha o mockup): quanto mais tempo em
// aberto, mais urgente — verde recente, âmbar intermediário, vermelho longo.
function daysOpenTone(days: number): StatusTone {
  if (days <= 10) return "green";
  if (days <= 20) return "amber";
  return "red";
}

// Status de assinatura → tom (mockup: Pendente âmbar, Enviada azul, Assinada verde).
const SIGNATURE_TONE: Record<ServiceOrderSignatureState, StatusTone> = {
  none: "amber",
  pending: "indigo",
  signed: "green",
  expired: "amber",
  cancelled: "amber",
};

type SearchParams = Promise<{ page?: string; search?: string; tab?: string }>;

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
  // Abas do mockup: "OS Abertas" (não assinadas, padrão) e "OS Assinadas".
  const signed = sp.tab === "assinadas";

  const result = await listServiceOrdersAction({ page, q: sp.search, signed });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const params = { search: sp.search, tab: sp.tab };

  const TABS = [
    { key: undefined, label: "OS Abertas", active: !signed },
    { key: "assinadas", label: "OS Assinadas", active: signed },
  ] as const;

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<ServiceOrderIcon />}
        title="Gestão de OS"
        description="Acompanhe o progresso e gerencie as Ordens de Serviço registradas."
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/service-orders"
            placeholder="Buscar por nome, empresa ou tipo de OS…"
            defaultValue={sp.search}
            hidden={{ tab: sp.tab }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((tab) => (
              <Link
                key={tab.label}
                href={tab.key ? `/service-orders?tab=${tab.key}` : "/service-orders"}
                className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  tab.active
                    ? "btn-primary"
                    : "text-text-muted hover:text-text border border-white/70 bg-white/50"
                }`}
              >
                {tab.label}
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
                  { header: "Empresa" },
                  { header: "Tipo OS" },
                  { header: "Data Emissão" },
                  { header: "Dias Aberta" },
                  { header: "Status Assinatura" },
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
                  <Cell>{row.companyName ?? "—"}</Cell>
                  <Cell>{row.osTypeLabel ?? "—"}</Cell>
                  <Cell className="text-text-muted font-mono">{row.openedAt}</Cell>
                  <Cell>
                    <StatusBadge tone={daysOpenTone(row.daysOpen)}>
                      {row.daysOpen} {row.daysOpen === 1 ? "dia" : "dias"}
                    </StatusBadge>
                  </Cell>
                  <Cell>
                    <StatusBadge tone={SIGNATURE_TONE[row.signatureState] ?? "neutral"}>
                      {row.signatureLabel}
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
