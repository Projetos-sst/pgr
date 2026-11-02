import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { todayInSaoPaulo } from "@/shared/dates";
import { classifyDocumentValidity } from "@/shared/domains/documents/validity";
import {
  EXAM_DUE_WINDOW_DAYS,
  EXAM_TYPES,
  EXAM_TYPE_LABELS,
  examBadge,
  type ExamType,
} from "@/shared/domains/pgr/health-exams";
import { listHealthExamsAction } from "@/shared/server/actions/pgr/health-exams";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import { medicineErrorLabel } from "@/shared/domains/medicine/error-messages";

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
import { ListErrorState, hrefWithParams } from "../_ui/list-error-state";
import { MedicineEmptyState } from "../medicine/_components/medicine-empty-state";
import { DeleteHealthExam } from "./_components/delete-health-exam";
import { HealthExamFilters } from "./_components/health-exam-filters";
import { HealthExamIcon } from "./_components/health-exam-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1.1fr 1.7fr 1.1fr 1.2fr 1.1fr 1fr 84px";

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

type SearchParams = Promise<{
  search?: string;
  examType?: string;
  companyId?: string;
  employeeId?: string;
  page?: string;
}>;

/** Mensagem da falha de leitura por código do contrato (erro ≠ vazio). */
const LIST_ERROR: Record<string, { title: string; description: string }> = {
  VALIDATION: {
    title: "Filtro inválido",
    description:
      "Um dos filtros da URL não é válido. Limpe os filtros e tente novamente.",
  },
};

export default async function HealthExamsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireOfficeStaffPage();
  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const companyId = sp.companyId?.trim() || undefined;
  const employeeId = sp.employeeId?.trim() || undefined;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const rawExamType = sp.examType?.trim() || undefined;
  // Tipo válido alimenta o filtro da tela; o valor cru vai para a Action, que
  // recusa tipo fora do enum (VALIDATION → "Filtro inválido") em vez de ignorá-lo.
  const examType = (EXAM_TYPES as readonly string[]).includes(rawExamType ?? "")
    ? (rawExamType as ExamType)
    : undefined;
  const [result, companiesResult] = await Promise.all([
    listHealthExamsAction({
      search,
      examType: rawExamType,
      companyId,
      employeeId,
      page,
    }),
    listCompanyOptionsAction("medicine"),
  ]);
  const today = todayInSaoPaulo();
  // Filtros ativos (sem `page`) — preservados na paginação e no "Tentar novamente".
  const filterParams = { search, examType, companyId, employeeId };
  const retryHref = hrefWithParams("/health-exams", { ...filterParams, page: sp.page });
  const clearEmployeeHref = hrefWithParams("/health-exams", {
    search,
    examType,
    companyId,
  });
  const companies = companiesResult.ok
    ? companiesResult.data.map((c) => ({ id: c.id, razaoSocial: c.razaoSocial }))
    : null;
  const hasNoMedicineCompany = companies !== null && companies.length === 0;
  const employeeName =
    employeeId && result.ok ? result.data.rows[0]?.employeeName : undefined;

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
            search={search}
            examType={examType}
            companies={companies}
            companyId={companyId}
            employeeId={employeeId}
          />
          <ToolbarButton href="/health-exams/new">Novo Exame</ToolbarButton>
        </ListToolbar>

        {employeeId ? (
          <div className="bg-primary/5 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[rgba(120,120,150,0.1)] px-5 py-3 text-[13px]">
            <span className="text-text font-semibold">
              Filtrado por funcionário{employeeName ? `: ${employeeName}` : ""}
            </span>
            <a
              href={clearEmployeeHref}
              className="text-primary focus-visible:ring-primary-ring rounded font-bold hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
            >
              Limpar filtro de funcionário
            </a>
          </div>
        ) : null}

        {!result.ok ? (
          <ListErrorState
            isFlat
            code={medicineErrorLabel(result.error.code)}
            title={
              LIST_ERROR[result.error.code]?.title ??
              "Não foi possível carregar os exames"
            }
            description={
              LIST_ERROR[result.error.code]?.description ??
              "Isso não significa que não haja exames registrados. Tente novamente."
            }
            retryHref={retryHref}
          />
        ) : hasNoMedicineCompany ? (
          <div className="p-6">
            <MedicineEmptyState isFlat role={ctx.role} />
          </div>
        ) : result.data.rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              isFlat
              message={
                search || examType || companyId || employeeId
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
              {result.data.rows.map((row, i) => {
                const validity = classifyDocumentValidity(row.validUntil, {
                  today,
                  dueWindowDays: EXAM_DUE_WINDOW_DAYS,
                });
                const badge = examBadge(row.validUntil, row.aptitude, {
                  today,
                  dueWindowDays: EXAM_DUE_WINDOW_DAYS,
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
              total={result.data.total}
              params={filterParams}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
