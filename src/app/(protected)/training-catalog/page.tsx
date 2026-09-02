import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import {
  formatTrainingCode,
  trainingValidityLabel,
} from "@/shared/domains/pgr/trainings";
import {
  listTrainingCatalogAction,
  listTrainingNormsAction,
} from "@/shared/server/actions/pgr/training-catalog";

import { EmptyState, PageHeader } from "../_ui/list";
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
} from "../_ui/data-list";
import { DeleteTrainingCatalog } from "./_components/delete-training-catalog";
import { TrainingIcon } from "./_components/training-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "0.9fr 1.8fr 1fr 1fr 1.1fr 1fr 84px";

type SearchParams = Promise<{ search?: string; norm?: string; page?: string }>;

export default async function TrainingCatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const [result, normsResult] = await Promise.all([
    listTrainingCatalogAction({ search: sp.search, norm: sp.norm, page }),
    listTrainingNormsAction(),
  ]);
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const norms = normsResult.ok
    ? normsResult.data.map((n) => ({ value: n, label: n }))
    : [];
  const params = { search: sp.search, norm: sp.norm };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<TrainingIcon />}
        title="Treinamentos"
        description="Cursos e capacitações obrigatórias por Norma Regulamentadora"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/training-catalog"
            placeholder="Buscar por treinamento ou NR…"
            defaultValue={sp.search}
            hidden={{ norm: sp.norm }}
          />
          <ToolbarSelect
            basePath="/training-catalog"
            name="norm"
            defaultValue={sp.norm}
            options={norms}
            emptyLabel="Todas as NRs"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href="/training-catalog/new">Novo Treinamento</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search || sp.norm
                  ? "Nenhum treinamento encontrado para o filtro."
                  : "Nenhum treinamento cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={940}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Código" },
                  { header: "Treinamento" },
                  { header: "NR" },
                  { header: "Carga Horária" },
                  { header: "Validade" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/training-catalog/${row.id}/edit`}>
                    {formatTrainingCode(row.number)}
                  </MonoCell>
                  <Cell className="text-text font-semibold">{row.name}</Cell>
                  <Cell>{row.referenceNorm ?? "—"}</Cell>
                  <Cell className="text-text-muted font-mono">{row.workloadHours}h</Cell>
                  <Cell>{trainingValidityLabel(row.periodicity)}</Cell>
                  <Cell>
                    <StatusBadge tone={row.isActive ? "green" : "neutral"}>
                      {row.isActive ? "Vigente" : "Inativo"}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/training-catalog/${row.id}/edit`} />
                      <DeleteTrainingCatalog id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/training-catalog"
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
