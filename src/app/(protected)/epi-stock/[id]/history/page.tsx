import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { getEpiStockAction } from "@/shared/server/actions/pgr/epi-stock";
import { listStockMovementsAction } from "@/shared/server/actions/pgr/stock-movements";

import { EmptyState, PageHeader, Pagination, Table } from "../../../_ui/list";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string }>;

/** Data `YYYY-MM-DD` → `dd/mm/aaaa` sem `Date` (evita deslocamento de fuso). */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export default async function StockHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });

  const stockResult = await getEpiStockAction(id);
  if (!stockResult.ok) notFound();
  const stock = stockResult.data;

  const result = await listStockMovementsAction(id, { page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Histórico — ${stock.name}`}
        description={`Saldo atual: ${stock.currentBalance}. Movimentações do mais recente ao mais antigo, com o saldo resultante por linha.`}
        action={
          <Link
            href={`/epi-stock/${id}/edit`}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
          >
            Voltar ao item
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma movimentação registrada para este item." />
      ) : (
        <Table
          headers={[
            "Data",
            "Tipo",
            "Quantidade",
            "Saldo Resultante",
            "Nº NF",
            "Funcionário",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">{formatDate(row.movementDate)}</td>
              <td className="px-4 py-2">{row.typeLabel}</td>
              <td className="px-4 py-2">
                {row.signedQuantity > 0 ? `+${row.quantity}` : `−${row.quantity}`}
              </td>
              <td className="px-4 py-2 font-medium">{row.runningBalance}</td>
              <td className="px-4 py-2">{row.invoiceNumber ?? "—"}</td>
              <td className="px-4 py-2">{row.employeeName ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath={`/epi-stock/${id}/history`}
        page={page}
        pageSize={pageSize}
        total={total}
        params={{}}
      />
    </div>
  );
}
