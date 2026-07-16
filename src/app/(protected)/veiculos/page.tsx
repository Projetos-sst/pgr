import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listVehiclesAction } from "@/shared/server/actions/inspections/vehicles";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { DeleteVehicle } from "./_components/delete-vehicle";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function VeiculosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listVehiclesAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Veículos"
        description="Frota do escritório — base das inspeções veiculares."
        action={<PrimaryLink href="/veiculos/new">Novo veículo</PrimaryLink>}
      />
      <SearchForm
        basePath="/veiculos"
        placeholder="Buscar por placa, modelo ou marca"
        defaultValue={sp.search}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum veículo cadastrado." />
      ) : (
        <Table
          headers={["Placa", "Tipo", "Marca/Modelo", "Proprietário", "KM inicial", ""]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 font-mono">
                <Link
                  href={`/veiculos/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.plate}
                </Link>
              </td>
              <td className="px-4 py-2">{row.typeLabel}</td>
              <td className="px-4 py-2">
                {[row.brand, row.model].filter(Boolean).join(" ") || "—"}
              </td>
              <td className="px-4 py-2">{row.owner ?? "—"}</td>
              <td className="px-4 py-2 tabular-nums">{row.initialKm}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/veiculos/${row.id}/edit`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Editar
                  </Link>
                  <DeleteVehicle id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/veiculos"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search }}
      />
    </div>
  );
}
