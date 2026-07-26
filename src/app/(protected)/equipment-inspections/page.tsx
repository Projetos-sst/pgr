import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listEquipmentInspectionsAction } from "@/shared/server/actions/inspections/equipment-inspections";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
import { ChecklistRowAction, EditRowAction, RowActions } from "../_ui/row-actions";
import { DeleteInspection } from "./_components/delete-inspection";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string }>;

export default async function InspecoesEquipamentosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listEquipmentInspectionsAction({ page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Inspeções de equipamentos"
        description="Checklist de inspeção por máquina/equipamento, em duas etapas."
        action={
          <PrimaryLink href="/equipment-inspections/new">Nova inspeção</PrimaryLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma inspeção de equipamento." />
      ) : (
        <Table headers={["Data", "Equipamento", "Plano", "Responsável", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 tabular-nums">{row.inspectedAt}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/equipment-inspections/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.equipmentName ?? "—"}
                </Link>
              </td>
              <td className="px-4 py-2">{row.planTitle ?? "—"}</td>
              <td className="px-4 py-2">{row.responsible ?? "—"}</td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <ChecklistRowAction href={`/equipment-inspections/${row.id}`} />
                  <EditRowAction href={`/equipment-inspections/${row.id}/edit`} />
                  <DeleteInspection id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/equipment-inspections"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{}}
      />
    </div>
  );
}
