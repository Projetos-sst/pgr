import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listRiskAssessmentsAction } from "@/shared/server/actions/pgr/risk-assessments";
import { getRiskAction } from "@/shared/server/actions/pgr/risks";
import {
  assessmentCriterionLabel,
  riskClassificationLabel,
  type RiskClassification,
} from "@/shared/domains/pgr/risk-assessment";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  Table,
} from "../../../_ui/list";
import { DeleteAssessment } from "./_components/delete-assessment";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string }>;

function classificationText(result: string | null): string {
  return result ? riskClassificationLabel(result as RiskClassification) : "—";
}

export default async function RiskAssessmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const { id: riskId } = await params;
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });

  const riskResult = await getRiskAction(riskId);
  if (!riskResult.ok) notFound();

  const result = await listRiskAssessmentsAction(riskId, { page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const currentId = page === 1 && rows.length > 0 ? rows[0].id : null;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Avaliações de risco"
        description={riskResult.data.description}
        action={
          <div className="flex gap-2">
            <Link
              href={`/risks/${riskId}`}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
            >
              Voltar ao risco
            </Link>
            <PrimaryLink href={`/risks/${riskId}/assessments/new`}>
              Nova avaliação
            </PrimaryLink>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma avaliação registrada. Crie a primeira avaliação deste risco." />
      ) : (
        <Table
          headers={[
            "Data",
            "Critério",
            "Prob.",
            "Sev.",
            "Nível",
            "Classificação",
            "Incerteza",
            "",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">
                {row.assessedAt}
                {row.id === currentId ? (
                  <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium dark:bg-white/10">
                    Vigente
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-2">{assessmentCriterionLabel(row.criterion)}</td>
              <td className="px-4 py-2">{row.probability}</td>
              <td className="px-4 py-2">{row.severity}</td>
              <td className="px-4 py-2 font-medium">{row.riskLevel}</td>
              <td className="px-4 py-2">{classificationText(row.result)}</td>
              <td className="px-4 py-2">{row.uncertaintyDegree}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/risks/${riskId}/assessments/${row.id}/edit`}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
                  >
                    Editar
                  </Link>
                  <DeleteAssessment riskId={riskId} id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath={`/risks/${riskId}/assessments`}
        page={page}
        pageSize={pageSize}
        total={total}
        params={{}}
      />
    </div>
  );
}
