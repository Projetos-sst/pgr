import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listCampaignsAction } from "@/shared/server/actions/psychosocial/campaigns";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../../_ui/list";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string; status?: string }>;

export default async function CampanhasPsicossociaisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listCampaignsAction({ page, status: sp.status });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Campanhas psicossociais"
        description="Mapeamento de riscos psicossociais (NR-01/GRO) por campanha e questionário."
        action={
          <PrimaryLink href="/psicossocial/campanhas/new">Nova campanha</PrimaryLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma campanha psicossocial." />
      ) : (
        <Table headers={["Início", "Fim", "Empresa", "Obra", "Perguntas", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
              <td className="px-4 py-2 tabular-nums">{row.startsAt ?? "—"}</td>
              <td className="px-4 py-2 tabular-nums">{row.endsAt ?? "—"}</td>
              <td className="px-4 py-2">{row.companyName ?? "—"}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/psicossocial/campanhas/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.workUnitName ?? row.name}
                </Link>
              </td>
              <td className="px-4 py-2 tabular-nums">{row.questionCount}</td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2 text-right">
                <Link
                  href={`/psicossocial/campanhas/${row.id}`}
                  className="rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15"
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/psicossocial/campanhas"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ status: sp.status }}
      />
    </div>
  );
}
