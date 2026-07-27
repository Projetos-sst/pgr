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
import { EditRowAction, RowActions } from "../_ui/row-actions";
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
        action={<PrimaryLink href="/vehicles/new">Novo veículo</PrimaryLink>}
      />
      <SearchForm
        basePath="/vehicles"
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
                  href={`/vehicles/${row.id}/edit`}
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
                <RowActions>
                  <EditRowAction href={`/vehicles/${row.id}/edit`} />
                  <DeleteVehicle id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/vehicles"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search }}
      />
    </div>
  );
}
