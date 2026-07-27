import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listSafetyInspectionsAction } from "@/shared/server/actions/inspections/safety-inspections";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
import { EditRowAction, RowActions, ViewRowAction } from "../_ui/row-actions";
import { DeleteInspection } from "./_components/delete-inspection";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string }>;

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
  const result = await listSafetyInspectionsAction({ page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Inspeções de segurança"
        description="Inspeções livres (sem checklist) com registro de ocorrências e assinatura digital."
        action={<PrimaryLink href="/safety-inspections/new">Nova inspeção</PrimaryLink>}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma inspeção de segurança." />
      ) : (
        <Table headers={["Data", "Categoria", "Área", "Empresa", "Ocorr.", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 tabular-nums">{row.inspectedAt}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/safety-inspections/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.categoryLabel}
                </Link>
              </td>
              <td className="px-4 py-2">{row.area ?? "—"}</td>
              <td className="px-4 py-2">{row.companyName ?? "—"}</td>
              <td className="px-4 py-2 tabular-nums">{row.occurrenceCount}</td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <ViewRowAction href={`/safety-inspections/${row.id}`} label="Abrir" />
                  <EditRowAction href={`/safety-inspections/${row.id}/edit`} />
                  <DeleteInspection id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/safety-inspections"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{}}
      />
    </div>
  );
}
