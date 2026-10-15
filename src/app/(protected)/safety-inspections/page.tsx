import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  SAFETY_OUTCOME_LABELS,
  classifySafetyInspection,
  safetyInspectionNumber,
  type SafetyInspectionOutcome,
} from "@/shared/domains/inspections/safety-inspections";
import { resolvePageParams } from "@/shared/pagination";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";
import { listSafetyInspectionsAction } from "@/shared/server/actions/inspections/safety-inspections";

import { AutoSubmitSelect } from "../_ui/auto-submit-select";
import {
  EmptyState,
  ListCard,
  ListToolbar,
  PageHeader,
  Pagination,
  PrimaryLink,
  Table,
} from "../_ui/list";
import { RowActions, ViewRowAction } from "../_ui/row-actions";
import { StatusBadge, type StatusTone } from "../_ui/status-badge";

export const dynamic = "force-dynamic";

const BASE = "/safety-inspections";

const OUTCOME_TONES: Record<SafetyInspectionOutcome, StatusTone> = {
  in_progress: "neutral",
  compliant: "green",
  pending_items: "amber",
  critical: "red",
};

function formatIsoDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("pt-BR");
}

type SearchParams = Promise<{ page?: string; search?: string; companyId?: string }>;

export default async function InspecoesSegurancaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const [listResult, companiesResult] = await Promise.all([
    listSafetyInspectionsAction({ page, search: sp.search, companyId: sp.companyId }),
    listCompanyOptionsAction(),
  ]);
  const { rows, total } = listResult.ok ? listResult.data : { rows: [], total: 0 };
  const companies = companiesResult.ok ? companiesResult.data : [];
  const hasFilters = Boolean(sp.search || sp.companyId);

  return (
    <div className="animate-fade-slide-up mx-auto flex w-full max-w-[1320px] flex-col gap-[22px] px-5 pt-8 pb-10 sm:px-[30px]">
      <PageHeader
        title="Inspeções de Segurança"
        description="Inspeções planejadas de áreas, setores e frentes de trabalho"
        icon={
          <svg
            width="25"
            height="25"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
          >
            <path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z" />
            <path d="M9 11l2 2 4-4" />
          </svg>
        }
      />

      <ListCard>
        <ListToolbar>
          <form
            action={BASE}
            method="get"
            className="flex flex-1 flex-wrap items-center gap-3"
          >
            <div className="glass-input rounded-card focus-within:border-primary flex h-11 min-w-[200px] flex-1 items-center gap-2.5 px-4 focus-within:shadow-[0_0_0_3px_var(--color-primary-ring)]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                aria-hidden
                className="text-text-subtle shrink-0"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
              <label htmlFor="search" className="sr-only">
                Buscar por área ou setor
              </label>
              <input
                id="search"
                name="search"
                defaultValue={sp.search ?? ""}
                placeholder="Buscar por área ou setor…"
                className="text-text placeholder:text-text-subtle w-full bg-transparent text-[13px] outline-none"
              />
            </div>

            <label htmlFor="companyId" className="sr-only">
              Filtrar por empresa
            </label>
            <AutoSubmitSelect
              id="companyId"
              name="companyId"
              defaultValue={sp.companyId}
              emptyLabel="Todas as Empresas"
              options={companies.map((company) => ({
                value: company.id,
                label: company.razaoSocial,
              }))}
            />
          </form>

          <PrimaryLink href={`${BASE}/new`}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova Inspeção
          </PrimaryLink>
        </ListToolbar>

        {rows.length === 0 ? (
          <EmptyState
            isFlat
            message={
              hasFilters
                ? "Nenhuma inspeção de segurança corresponde aos filtros aplicados."
                : "Nenhuma inspeção de segurança registrada até agora."
            }
          />
        ) : (
          <>
            <Table
              isBare
              isZebra
              headers={[
                "Nº",
                "Área / Setor",
                "Empresa",
                "Data",
                "Não Conf.",
                "Status",
                "Opções",
              ]}
            >
              {rows.map((row) => {
                const outcome = classifySafetyInspection(row);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-[11px] whitespace-nowrap sm:px-6">
                      <Link
                        href={`${BASE}/${row.id}`}
                        className="text-primary font-mono font-semibold hover:underline"
                      >
                        {safetyInspectionNumber(row.id)}
                      </Link>
                    </td>
                    <td className="text-text px-4 py-[11px] font-semibold sm:px-6">
                      {row.area ?? "—"}
                    </td>
                    <td className="px-4 py-[11px] sm:px-6">{row.companyName ?? "—"}</td>
                    <td className="text-text-muted px-4 py-[11px] font-semibold whitespace-nowrap tabular-nums sm:px-6">
                      {formatIsoDate(row.inspectedAt)}
                    </td>
                    <td
                      className={`px-4 py-[11px] font-semibold whitespace-nowrap sm:px-6 ${
                        row.occurrenceCount > 0 ? "text-danger" : "text-accent-green"
                      }`}
                    >
                      {row.occurrenceCount > 0
                        ? `${row.occurrenceCount} ${row.occurrenceCount === 1 ? "aberta" : "abertas"}`
                        : "0"}
                    </td>
                    <td className="px-4 py-[11px] sm:px-6">
                      <StatusBadge
                        tone={OUTCOME_TONES[outcome]}
                        label={SAFETY_OUTCOME_LABELS[outcome]}
                      />
                    </td>
                    <td className="px-4 py-[11px] sm:px-6">
                      <RowActions>
                        <ViewRowAction href={`${BASE}/${row.id}`} />
                      </RowActions>
                    </td>
                  </tr>
                );
              })}
            </Table>

            <Pagination
              basePath={BASE}
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, companyId: sp.companyId }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
