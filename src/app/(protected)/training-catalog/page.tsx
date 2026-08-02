import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listTrainingCatalogAction } from "@/shared/server/actions/pgr/training-catalog";
import { trainingPeriodicityLabel } from "@/shared/domains/pgr/trainings";

import { EmptyState, PageHeader } from "../_ui/list";
import {
  Cell,
  DataGrid,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  ToolbarButton,
  ToolbarSearch,
  ViewIcon,
} from "../_ui/data-list";
import { DeleteTrainingCatalog } from "./_components/delete-training-catalog";
import { TrainingIcon } from "./_components/training-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "2fr 1.2fr 1fr 1.2fr 84px";

type SearchParams = Promise<{ search?: string; page?: string }>;

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
  const result = await listTrainingCatalogAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

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
          />
          <ToolbarButton href="/training-catalog/new">Novo Treinamento</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              isFlat
              message={
                sp.search
                  ? "Nenhum treinamento encontrado para a busca."
                  : "Nenhum treinamento cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={760}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Treinamento" },
                  { header: "NR / Norma" },
                  { header: "Carga horária" },
                  { header: "Periodicidade" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell className="text-text font-semibold">
                    <a
                      href={`/training-catalog/${row.id}/edit`}
                      className="hover:underline"
                    >
                      {row.name}
                    </a>
                  </Cell>
                  <Cell className={row.referenceNorm ? undefined : "text-text-subtle"}>
                    {row.referenceNorm ?? "—"}
                  </Cell>
                  <Cell className="tabular-nums">{row.workloadHours}h</Cell>
                  <Cell>{trainingPeriodicityLabel(row.periodicity)}</Cell>
                  <Cell align="right">
                    <span className="flex items-center justify-end gap-1">
                      <a
                        href={`/training-catalog/${row.id}/edit`}
                        aria-label="Ver/editar treinamento"
                        title="Ver/editar"
                        className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
                      >
                        <ViewIcon />
                      </a>
                      <DeleteTrainingCatalog id={row.id} />
                    </span>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/training-catalog"
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
