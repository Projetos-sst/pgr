import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listGesAction } from "@/shared/server/actions/pgr/ges";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { EditRowAction, RowActions } from "../_ui/row-actions";
import { DeleteGes } from "./_components/delete-ges";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  page?: string;
  companyId?: string;
  workUnitId?: string;
}>;

export default async function GesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listGesAction({
    search: sp.search,
    companyId: sp.companyId,
    workUnitId: sp.workUnitId,
    page,
  });
  const { rows, total, totalWorkers } = result.ok
    ? result.data
    : { rows: [], total: 0, totalWorkers: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="GES"
        description="Grupos de Exposição Similar (caracterização ambiental)."
        action={<PrimaryLink href="/ges/new">Novo GES</PrimaryLink>}
      />

      <div className="glass-card w-fit px-5 py-3">
        <p className="text-text-muted text-sm">Total de Trabalhadores</p>
        <p className="text-text text-2xl font-semibold">{totalWorkers}</p>
      </div>

      <SearchForm
        basePath="/ges"
        placeholder="Buscar por nome ou descrição"
        defaultValue={sp.search}
        hidden={{ companyId: sp.companyId, workUnitId: sp.workUnitId }}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum GES encontrado." />
      ) : (
        <Table headers={["Nome", "Descrição do processo", "Expostos", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link
                  href={`/ges/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-2">{row.processDescription ?? "—"}</td>
              <td className="px-4 py-2">{row.exposedWorkers}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <EditRowAction href={`/ges/${row.id}/edit`} label="Gerenciar" />
                  <DeleteGes id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/ges"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search, companyId: sp.companyId, workUnitId: sp.workUnitId }}
      />
    </div>
  );
}
