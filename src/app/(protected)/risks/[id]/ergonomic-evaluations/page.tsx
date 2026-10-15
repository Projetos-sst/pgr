import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listErgonomicEvaluationsAction } from "@/shared/server/actions/pgr/ergonomic-evaluations";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import {
  ergonomicAdequacyText,
  ergonomicAdequacyTone,
  summarizeErgonomicDimensions,
} from "@/shared/domains/pgr/ergonomics";

import { EmptyState, PageHeader } from "../../../_ui/list";
import {
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
} from "../../../_ui/data-list";
import { DeleteErgonomicEvaluation } from "./_components/delete-ergonomic-evaluation";
import { ErgonomicIcon } from "./_components/ergonomic-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1fr 1.4fr 1.6fr 1.6fr 1fr 110px";

export default async function ErgonomicEvaluationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireOfficeStaffPage();
  const { id: riskId } = await params;
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });

  const riskResult = await getRiskAction(riskId);
  if (!riskResult.ok) notFound();

  const basePath = `/risks/${riskId}/ergonomic-evaluations`;
  const result = await listErgonomicEvaluationsAction(riskId, { page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  // A vigente é a primeira linha da primeira página (mesma ordem do repositório).
  const currentId = page === 1 && rows.length > 0 ? rows[0].id : null;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-[22px] px-4 py-8 sm:px-8">
      <PageHeader
        backHref={`/risks/${riskId}`}
        icon={<ErgonomicIcon />}
        title="Avaliação ergonômica (NR-17)"
        description={riskResult.data.description}
      />

      <ListCard>
        <ListToolbar>
          <p className="text-text-subtle flex-1 text-[13px]">
            Histórico completo das avaliações preliminares (AEP) deste risco. Criar uma
            avaliação nova <strong>não</strong> apaga as anteriores — a vigente é a de
            data mais recente.
          </p>
          <ToolbarButton href={`${basePath}/new`}>Nova avaliação</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Sem avaliação ergonômica registrada. Crie a primeira avaliação deste risco." />
          </div>
        ) : (
          <>
            <DataGrid minWidth={1000}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Data", align: "center" },
                  { header: "Situação", align: "center" },
                  { header: "Responsável" },
                  { header: "Método / instrumento" },
                  { header: "Dimensões", align: "center" },
                  { header: "Opções", align: "center" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <Cell align="center" className="text-text font-semibold">
                    {row.assessedAt}
                  </Cell>
                  <Cell align="center">
                    <span className="flex justify-center">
                      <StatusBadge tone={row.id === currentId ? "indigo" : "neutral"}>
                        {row.id === currentId ? "Vigente" : "Histórico"}
                      </StatusBadge>
                    </span>
                  </Cell>
                  <Cell className="text-text-muted">{row.responsible ?? "—"}</Cell>
                  <Cell className="text-text-muted">{row.method ?? "—"}</Cell>
                  <Cell align="center" className="text-text-muted">
                    {summarizeErgonomicDimensions(row)}
                  </Cell>
                  <Cell align="center">
                    <RowActions align="center">
                      <EditIconLink href={`${basePath}/${row.id}/edit`} />
                      <DeleteErgonomicEvaluation riskId={riskId} id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath={basePath}
              page={page}
              pageSize={pageSize}
              total={total}
              params={{}}
            />
          </>
        )}
      </ListCard>

      {currentId ? (
        <section className="glass-card rounded-[20px] p-5 sm:p-6">
          <h2 className="text-primary mb-4 font-mono text-[11px] tracking-[0.14em] uppercase">
            Dimensões da avaliação vigente
          </h2>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {[
              ["Postura", rows[0].posture],
              ["Movimentos", rows[0].movements],
              ["Carga física", rows[0].physicalLoad],
              ["Carga mental", rows[0].mentalLoad],
              ["Organização do trabalho", rows[0].workOrganization],
              ["Ambiente físico", rows[0].physicalEnvironment],
            ].map(([label, value]) => (
              <li
                key={label as string}
                className="glass-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5"
              >
                <span className="text-text-muted text-[13px] font-semibold">{label}</span>
                <StatusBadge
                  tone={ergonomicAdequacyTone(
                    value as Parameters<typeof ergonomicAdequacyTone>[0],
                  )}
                >
                  {ergonomicAdequacyText(
                    value as Parameters<typeof ergonomicAdequacyText>[0],
                  )}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
