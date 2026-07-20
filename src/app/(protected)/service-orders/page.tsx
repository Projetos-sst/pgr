import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import {
  serviceOrderStatusSchema,
  SERVICE_ORDER_STATUS_LABELS,
} from "@/shared/domains/safety/service-order";
import { resolvePageParams } from "@/shared/pagination";
import { listServiceOrdersAction } from "@/shared/server/actions/safety/service-orders";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { DeleteServiceOrder } from "./_components/delete-service-order";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string; search?: string; status?: string }>;

export default async function ServiceOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const parsedStatus = serviceOrderStatusSchema.safeParse(sp.status);
  const status = parsedStatus.success ? parsedStatus.data : undefined;

  const result = await listServiceOrdersAction({ page, q: sp.search, status });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  const params = { search: sp.search, status: sp.status };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Ordens de Serviço"
        description="Documente a entrega de EPIs e instruções ao trabalhador com checklist e número por escritório."
        action={<PrimaryLink href="/service-orders/new">Nova OS</PrimaryLink>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchForm
          basePath="/service-orders"
          placeholder="Buscar por título ou número"
          defaultValue={sp.search}
          hidden={{ status: sp.status }}
        />
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/service-orders"
            className={`glass-panel rounded-card px-3 py-1 font-semibold transition-colors ${
              !sp.status ? "text-primary-strong" : "text-text-muted hover:text-text"
            }`}
          >
            Todas
          </Link>
          {Object.entries(SERVICE_ORDER_STATUS_LABELS).map(([value, label]) => (
            <Link
              key={value}
              href={`/service-orders?status=${value}`}
              className={`glass-panel rounded-card px-3 py-1 font-semibold transition-colors ${
                sp.status === value
                  ? "text-primary-strong"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma Ordem de Serviço encontrada." />
      ) : (
        <Table
          headers={[
            "Nº",
            "Título",
            "Funcionário",
            "Aberta em",
            "Dias",
            "Itens",
            "Status",
            "",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 tabular-nums">#{row.number}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/service-orders/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.title}
                </Link>
              </td>
              <td className="px-4 py-2">{row.employeeName ?? "—"}</td>
              <td className="px-4 py-2 tabular-nums">{row.openedAt}</td>
              <td className="px-4 py-2 tabular-nums">{row.daysOpen}</td>
              <td className="px-4 py-2 tabular-nums">{row.itemCount}</td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/service-orders/${row.id}`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Abrir
                  </Link>
                  <Link
                    href={`/service-orders/${row.id}/edit`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Editar
                  </Link>
                  <DeleteServiceOrder id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/service-orders"
        page={page}
        pageSize={pageSize}
        total={total}
        params={params}
      />
    </div>
  );
}
