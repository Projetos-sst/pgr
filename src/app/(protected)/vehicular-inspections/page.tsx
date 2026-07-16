import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listVehicularInspectionsAction } from "@/shared/server/actions/inspections/vehicular-inspections";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
import { DeleteInspection } from "./_components/delete-inspection";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string }>;

export default async function InspecoesVeicularesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listVehicularInspectionsAction({ page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Inspeções veiculares"
        description="Checklist de inspeção por veículo, em duas etapas (cabeçalho + itens)."
        action={
          <PrimaryLink href="/vehicular-inspections/new">Nova inspeção</PrimaryLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma inspeção veicular." />
      ) : (
        <Table headers={["Data", "Veículo", "Plano", "Responsável", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 tabular-nums">{row.inspectedAt}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/vehicular-inspections/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.vehiclePlate ?? "—"}
                </Link>
              </td>
              <td className="px-4 py-2">{row.planTitle ?? "—"}</td>
              <td className="px-4 py-2">{row.responsible ?? "—"}</td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/vehicular-inspections/${row.id}`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Checklist
                  </Link>
                  <Link
                    href={`/vehicular-inspections/${row.id}/edit`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Editar
                  </Link>
                  <DeleteInspection id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/vehicular-inspections"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{}}
      />
    </div>
  );
}
