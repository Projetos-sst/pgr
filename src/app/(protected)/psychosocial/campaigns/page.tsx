import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listCampaignsAction } from "@/shared/server/actions/psychosocial/campaigns";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../../_ui/list";
import { ViewRowAction } from "../../_ui/row-actions";

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
          <PrimaryLink href="/psychosocial/campaigns/new">Nova campanha</PrimaryLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhuma campanha psicossocial." />
      ) : (
        <Table headers={["Início", "Fim", "Empresa", "Obra", "Perguntas", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2 tabular-nums">{row.startsAt ?? "—"}</td>
              <td className="px-4 py-2 tabular-nums">{row.endsAt ?? "—"}</td>
              <td className="px-4 py-2">{row.companyName ?? "—"}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/psychosocial/campaigns/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.workUnitName ?? row.name}
                </Link>
              </td>
              <td className="px-4 py-2 tabular-nums">{row.questionCount}</td>
              <td className="px-4 py-2">{row.statusLabel}</td>
              <td className="px-4 py-2 text-right">
                <ViewRowAction href={`/psychosocial/campaigns/${row.id}`} label="Abrir" />
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/psychosocial/campaigns"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ status: sp.status }}
      />
    </div>
  );
}
