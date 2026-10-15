import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { todayInSaoPaulo } from "@/shared/dates";
import { classifyDocumentValidity } from "@/shared/domains/documents/validity";
import {
  EXAM_TYPES,
  EXAM_TYPE_LABELS,
  examBadge,
  type ExamType,
} from "@/shared/domains/pgr/health-exams";
import { listHealthExamsAction } from "@/shared/server/actions/pgr/health-exams";

import { EmptyState, PageHeader } from "../_ui/list";
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
  ViewIcon,
} from "../_ui/data-list";
import { DeleteHealthExam } from "./_components/delete-health-exam";
import { HealthExamFilters } from "./_components/health-exam-filters";
import { HealthExamIcon } from "./_components/health-exam-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1.1fr 1.7fr 1.1fr 1.2fr 1.1fr 1fr 84px";
const DUE_WINDOW_DAYS = 30;

const VALIDITY_COLOR: Record<string, string> = {
  expired: "#d33a3f",
  due_soon: "#c9820a",
  ok: "#0e9f6e",
  no_expiry: "#8c91a8",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type SearchParams = Promise<{ search?: string; examType?: string; page?: string }>;

export default async function HealthExamsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const examType = (EXAM_TYPES as readonly string[]).includes(sp.examType ?? "")
    ? (sp.examType as ExamType)
    : undefined;
  const result = await listHealthExamsAction({ search: sp.search, examType, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const today = todayInSaoPaulo();

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<HealthExamIcon />}
        title="Gestão de Saúde Ocupacional"
        description="Controle de exames (ASO) e monitoramento da saúde dos trabalhadores"
      />

      <ListCard>
        <ListToolbar>
          <HealthExamFilters
            basePath="/health-exams"
            search={sp.search}
            examType={sp.examType}
          />
          <ToolbarButton href="/health-exams/new">Novo Exame</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              isFlat
              message={
                sp.search || examType
                  ? "Nenhum exame encontrado para os filtros."
                  : "Nenhum exame registrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={900}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Funcionário" },
                  { header: "Tipo de Exame" },
                  { header: "Médico" },
                  { header: "Realizado" },
                  { header: "Vencimento" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => {
                const validity = classifyDocumentValidity(row.validUntil, {
                  today,
                  dueWindowDays: DUE_WINDOW_DAYS,
                });
                const badge = examBadge(row.validUntil, row.aptitude, {
                  today,
                  dueWindowDays: DUE_WINDOW_DAYS,
                });
                return (
                  <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                    <Cell className="text-text font-semibold">{row.employeeName}</Cell>
                    <Cell>{EXAM_TYPE_LABELS[row.examType]}</Cell>
                    <Cell className={row.doctorName ? undefined : "text-text-subtle"}>
                      {row.doctorName ?? "—"}
                    </Cell>
                    <Cell className="text-text-muted font-semibold">
                      {formatDate(row.performedAt)}
                    </Cell>
                    <Cell>
                      <span
                        className="font-semibold"
                        style={{ color: VALIDITY_COLOR[validity] }}
                      >
                        {formatDate(row.validUntil)}
                      </span>
                    </Cell>
                    <Cell>
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    </Cell>
                    <Cell align="right">
                      <span className="flex items-center justify-end gap-1">
                        <a
                          href={`/health-exams/${row.id}/edit`}
                          aria-label="Ver/editar exame"
                          title="Ver/editar"
                          className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
                        >
                          <ViewIcon />
                        </a>
                        <DeleteHealthExam id={row.id} />
                      </span>
                    </Cell>
                  </GridRow>
                );
              })}
            </DataGrid>
            <ListFooter
              basePath="/health-exams"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, examType: sp.examType }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
