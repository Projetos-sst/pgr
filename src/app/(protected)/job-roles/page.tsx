import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listJobRolesAction } from "@/shared/server/actions/pgr/job-roles";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { DeleteJobRole } from "./_components/delete-job-role";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string; companyId?: string }>;

export default async function JobRolesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listJobRolesAction({
    search: sp.search,
    companyId: sp.companyId,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Funções (Cargos)"
        description="Cargos ocupacionais por empresa (com CBO)."
        action={<PrimaryLink href="/job-roles/new">Nova função</PrimaryLink>}
      />
      <SearchForm
        basePath="/job-roles"
        placeholder="Buscar por título ou CBO"
        defaultValue={sp.search}
        hidden={{ companyId: sp.companyId }}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma função encontrada." />
      ) : (
        <Table headers={["Título", "CBO", "Jornada", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2">
                <Link href={`/job-roles/${row.id}/edit`} className="font-medium hover:underline">
                  {row.title}
                </Link>
              </td>
              <td className="px-4 py-2">{row.cbo ?? "—"}</td>
              <td className="px-4 py-2">{row.workSchedule ?? "—"}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/job-roles/${row.id}/edit`}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
                  >
                    Editar
                  </Link>
                  <DeleteJobRole id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/job-roles"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search, companyId: sp.companyId }}
      />
    </div>
  );
}
