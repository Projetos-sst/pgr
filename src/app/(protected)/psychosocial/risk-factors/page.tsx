import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import {
  PSYCHOSOCIAL_RISK_LEVELS,
  formatPsychosocialFactorCode,
  psychosocialFactorStatusLabel,
  psychosocialFactorStatusTone,
  psychosocialRiskLevelLabel,
  psychosocialRiskLevelTone,
} from "@/shared/domains/psychosocial/risk-factors";
import { listPsychosocialRiskFactorsAction } from "@/shared/server/actions/psychosocial/risk-factors";

import { EmptyState, PageHeader } from "../../_ui/list";
import {
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  MonoCell,
  RowActions,
  StatusBadge,
  ToolbarButton,
  ToolbarSearch,
  ToolbarSelect,
} from "../../_ui/data-list";
import { DeleteRiskFactor } from "./_components/delete-risk-factor";
import { PsychosocialIcon } from "./_components/psychosocial-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "0.8fr 1.8fr 1.2fr 1fr 1.2fr 1.1fr 84px";
const BASE_PATH = "/psychosocial/risk-factors";

const LEVEL_OPTIONS = PSYCHOSOCIAL_RISK_LEVELS.map((value) => ({
  value,
  label: psychosocialRiskLevelLabel(value),
}));

type SearchParams = Promise<{ search?: string; level?: string; page?: string }>;

export default async function PsychosocialRiskFactorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listPsychosocialRiskFactorsAction({
    search: sp.search,
    level: sp.level,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const params = { search: sp.search, level: sp.level };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<PsychosocialIcon />}
        title="Gestão de Riscos Psicossociais"
        description="Fatores psicossociais mapeados por GES, conforme NR-01"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath={BASE_PATH}
            placeholder="Buscar por fator de risco…"
            defaultValue={sp.search}
            hidden={{ level: sp.level }}
          />
          <ToolbarSelect
            basePath={BASE_PATH}
            name="level"
            defaultValue={sp.level}
            options={LEVEL_OPTIONS}
            emptyLabel="Todos os Níveis"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href={`${BASE_PATH}/new`}>Novo Fator</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search || sp.level
                  ? "Nenhum fator de risco encontrado para o filtro."
                  : "Nenhum fator de risco psicossocial cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={960}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Código" },
                  { header: "Fator de Risco" },
                  { header: "GES" },
                  { header: "Nível" },
                  { header: "Avaliação" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`${BASE_PATH}/${row.id}/edit`}>
                    {formatPsychosocialFactorCode(row.number)}
                  </MonoCell>
                  <Cell className="text-text font-semibold">{row.name}</Cell>
                  <Cell className="text-text-muted">{row.gesName ?? "—"}</Cell>
                  <Cell>
                    <StatusBadge tone={psychosocialRiskLevelTone(row.level)}>
                      {psychosocialRiskLevelLabel(row.level)}
                    </StatusBadge>
                  </Cell>
                  <Cell className="text-text-muted font-semibold">
                    {row.assessmentMethod ?? "—"}
                  </Cell>
                  <Cell>
                    <StatusBadge tone={psychosocialFactorStatusTone(row.status)}>
                      {psychosocialFactorStatusLabel(row.status)}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`${BASE_PATH}/${row.id}/edit`} />
                      <DeleteRiskFactor id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath={BASE_PATH}
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
