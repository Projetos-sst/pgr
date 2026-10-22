import Link from "next/link";

import type { MedicineEmployeeItem } from "@/shared/domains/medicine/employees";
import { EXAM_TYPE_LABELS, examBadge } from "@/shared/domains/pgr/health-exams";

import { EmptyState } from "../../_ui/list";
import {
  Cell,
  DataGrid,
  GridHeader,
  GridRow,
  ListFooter,
  StatusBadge,
} from "../../_ui/data-list";

const TEMPLATE = "1.6fr 1.1fr 1.1fr 1.3fr 1fr 1.1fr";

const STATUS_LABEL: Record<string, string> = {
  on_leave: "Afastado",
  dismissed: "Desligado",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Funcionários da empresa selecionada com a situação do último exame. Grade com
 * `minWidth` rola DENTRO do cartão (a página nunca rola na horizontal). Badge
 * sempre com texto; sem exame → neutro "Sem exame registrado". Sem CPF nem
 * observações: o contrato `MedicineEmployeeItem` já não os traz.
 */
export function MedicineEmployeeList({
  rows,
  total,
  page,
  pageSize,
  companyId,
  search,
  today,
  dueWindowDays,
}: {
  rows: MedicineEmployeeItem[];
  total: number;
  page: number;
  pageSize: number;
  companyId: string;
  search?: string;
  today: string;
  dueWindowDays: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          isFlat
          message={
            search
              ? "Nenhum funcionário encontrado para a busca."
              : "Nenhum funcionário nesta empresa."
          }
        />
      </div>
    );
  }

  return (
    <>
      <DataGrid minWidth={860}>
        <GridHeader
          template={TEMPLATE}
          columns={[
            { header: "Funcionário" },
            { header: "Função" },
            { header: "GES" },
            { header: "Último exame" },
            { header: "Validade informada" },
            { header: "Situação" },
          ]}
        />
        {rows.map((row, i) => {
          const exam = row.latestExam;
          const badge = exam
            ? examBadge(exam.validUntil, exam.aptitude, { today, dueWindowDays })
            : null;
          const statusLabel = STATUS_LABEL[row.status];
          return (
            <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
              <Cell>
                <Link
                  href={`/employees/${row.id}`}
                  className="text-text hover:text-primary focus-visible:ring-primary-ring rounded font-semibold hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
                >
                  {row.fullName}
                </Link>
                {statusLabel ? (
                  <span className="text-text-subtle block text-[11px] font-semibold">
                    {statusLabel}
                  </span>
                ) : null}
              </Cell>
              <Cell className={row.jobRoleTitle ? undefined : "text-text-subtle"}>
                {row.jobRoleTitle ?? "—"}
              </Cell>
              <Cell className={row.gesName ? undefined : "text-text-subtle"}>
                {row.gesName ?? "—"}
              </Cell>
              <Cell>
                {exam ? (
                  <>
                    <span className="text-text block">
                      {EXAM_TYPE_LABELS[exam.examType]}
                    </span>
                    <span className="text-text-muted font-mono text-[12px] tabular-nums">
                      {formatDate(exam.performedAt)}
                    </span>
                  </>
                ) : (
                  <span className="text-text-subtle">—</span>
                )}
              </Cell>
              <Cell>
                {exam?.validUntil ? (
                  <span className="text-text-muted font-mono text-[12px] tabular-nums">
                    {formatDate(exam.validUntil)}
                  </span>
                ) : (
                  <span className="text-text-subtle text-[12px]">
                    {exam ? "Sem validade informada" : "—"}
                  </span>
                )}
              </Cell>
              <Cell>
                {badge ? (
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Sem exame registrado</StatusBadge>
                )}
              </Cell>
            </GridRow>
          );
        })}
      </DataGrid>
      <ListFooter
        basePath="/medicine"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ companyId, search }}
      />
    </>
  );
}
