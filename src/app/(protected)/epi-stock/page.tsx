import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import {
  epiStockStatusSchema,
  type EpiStockStatus,
} from "@/shared/domains/pgr/epi-stock";
import { listEpiStockAction } from "@/shared/server/actions/pgr/epi-stock";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
import { DeleteEpiStock } from "./_components/delete-epi-stock";
import { StockStatusBadge } from "./_components/status-badge";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  page?: string;
  status?: string;
  withBalanceOnly?: string;
}>;

const STATUS_OPTIONS: { value: "" | EpiStockStatus; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "sem_saldo", label: "Sem saldo" },
  { value: "abaixo_minima", label: "Abaixo da mínima" },
  { value: "acima_minima", label: "Acima da mínima" },
];

export default async function EpiStockPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const status = epiStockStatusSchema.safeParse(sp.status);
  const withBalanceOnly = sp.withBalanceOnly === "true";

  const result = await listEpiStockAction({
    search: sp.search,
    status: status.success ? status.data : undefined,
    withBalanceOnly,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Estoque de EPI"
        description="Saldo e quantidade mínima por item do catálogo. O saldo é alterado por movimentações."
        action={<PrimaryLink href="/epi-stock/new">Adicionar ao estoque</PrimaryLink>}
      />

      <form action="/epi-stock" method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Buscar</span>
          <input
            name="search"
            defaultValue={sp.search ?? ""}
            placeholder="Nome ou CA"
            className="w-56 rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Status</span>
          <select
            name="status"
            defaultValue={status.success ? status.data : ""}
            className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            name="withBalanceOnly"
            value="true"
            defaultChecked={withBalanceOnly}
          />
          Apenas com saldo
        </label>
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
        >
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum item no estoque. Comece adicionando um item do catálogo." />
      ) : (
        <Table
          headers={[
            "CA",
            "Nome",
            "Tam.",
            "Und. Medida",
            "Mínima",
            "Saldo",
            "Status",
            "",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">{row.ca ?? "—"}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/epi-stock/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-2">{row.size ?? "—"}</td>
              <td className="px-4 py-2">{row.unitOfMeasure ?? "—"}</td>
              <td className="px-4 py-2">{row.minimumQuantity}</td>
              <td className="px-4 py-2 font-medium">{row.currentBalance}</td>
              <td className="px-4 py-2">
                <StockStatusBadge status={row.status} />
              </td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/epi-stock/${row.id}/edit`}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
                  >
                    Gerenciar
                  </Link>
                  <DeleteEpiStock id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/epi-stock"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{
          search: sp.search,
          status: status.success ? status.data : undefined,
          withBalanceOnly: withBalanceOnly ? "true" : undefined,
        }}
      />
    </div>
  );
}
