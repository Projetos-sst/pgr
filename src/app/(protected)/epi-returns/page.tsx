import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listPendingReturnsAction } from "@/shared/server/actions/pgr/epi-returns";

import { EmptyState, PageHeader, Pagination, SearchForm, Table } from "../_ui/list";
import { ReturnItemButton } from "./_components/return-item-button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string; search?: string }>;

/** Data `YYYY-MM-DD` → `dd/mm/aaaa` sem `Date` (evita deslocamento de fuso). */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export default async function EpiReturnsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });

  const result = await listPendingReturnsAction({ page, search });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Devoluções de EPI"
        description="EPIs entregues e ainda não devolvidos. Ao devolver, o saldo do estoque é reposto."
      />

      <SearchForm
        basePath="/epi-returns"
        placeholder="Buscar por nome ou CA"
        defaultValue={search}
      />

      {rows.length === 0 ? (
        <EmptyState
          message={
            search
              ? "Nenhum item pendente encontrado para a busca."
              : "Nenhum EPI pendente de devolução."
          }
        />
      ) : (
        <Table
          headers={["Funcionário", "EPI", "CA", "Quantidade", "Entregue em", "Ação"]}
        >
          {rows.map((row) => (
            <tr key={row.itemId} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">{row.employeeName}</td>
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2">{row.ca ?? "—"}</td>
              <td className="px-4 py-2">{row.quantity}</td>
              <td className="px-4 py-2">{formatDate(row.deliveryDate)}</td>
              <td className="px-4 py-2">
                <ReturnItemButton itemId={row.itemId} deliveryId={row.deliveryId} />
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/epi-returns"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search }}
      />
    </div>
  );
}
