import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listCampaignsAction } from "@/shared/server/actions/psychosocial/campaigns";

import { EmptyState, PageHeader } from "../../_ui/list";
import {
  Cell,
  DataGrid,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  StatusBadge,
  ToolbarButton,
  ToolbarSelect,
  ViewIcon,
  type StatusTone,
} from "../../_ui/data-list";
import { CAMPAIGN_STATUS_LABELS } from "@/shared/domains/psychosocial/campaigns";
import { PsychosocialIcon } from "../_components/psychosocial-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1.8fr 1.4fr 1.3fr 1fr 1fr 0.9fr 1fr 84px";

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  active: "green",
  closed: "indigo",
  archived: "neutral",
};

type SearchParams = Promise<{ page?: string; status?: string }>;

export default async function CampanhasPsicossociaisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listCampaignsAction({ page, status: sp.status });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-[22px] px-5 pt-8 pb-10 sm:px-[30px]">
      <PageHeader
        icon={<PsychosocialIcon />}
        title="Campanhas Psicossociais"
        description="Mapeamento de riscos psicossociais (NR-01/GRO) por campanha e questionário"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSelect
            basePath="/psychosocial/campaigns"
            name="status"
            defaultValue={sp.status}
            emptyLabel="Todos os status"
            options={Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <ToolbarButton href="/psychosocial/campaigns/new">Nova Campanha</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              isFlat
              message={
                sp.status
                  ? "Nenhuma campanha encontrada para o filtro."
                  : "Nenhuma campanha psicossocial cadastrada."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={1080}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Campanha" },
                  { header: "Empresa" },
                  { header: "Unidade / Obra" },
                  { header: "Início" },
                  { header: "Fim" },
                  { header: "Perguntas" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell className="text-text font-semibold">
                    <Link
                      href={`/psychosocial/campaigns/${row.id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </Link>
                  </Cell>
                  <Cell className={row.companyName ? undefined : "text-text-subtle"}>
                    {row.companyName ?? "—"}
                  </Cell>
                  <Cell>{row.workUnitName ?? "—"}</Cell>
                  <Cell className="tabular-nums">{row.startsAt ?? "—"}</Cell>
                  <Cell className="tabular-nums">{row.endsAt ?? "—"}</Cell>
                  <Cell className="tabular-nums">{row.questionCount}</Cell>
                  <Cell>
                    <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"}>
                      {row.statusLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <Link
                      href={`/psychosocial/campaigns/${row.id}`}
                      aria-label="Abrir campanha"
                      title="Abrir"
                      className="text-primary flex h-8 w-8 items-center justify-center justify-self-end rounded-[9px] transition-colors hover:bg-white/50"
                    >
                      <ViewIcon />
                    </Link>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/psychosocial/campaigns"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ status: sp.status }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
