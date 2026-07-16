import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listPgrAction } from "@/shared/server/actions/pgr/pgr";
import { listCompanyOptionsAction } from "@/shared/server/actions/pgr/companies";

import { EmptyState, PageHeader, Pagination, PrimaryLink, Table } from "../_ui/list";
import { PgrFilters } from "./_components/pgr-filters";
import { DeletePgr } from "./_components/delete-pgr";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ companyId?: string; workUnitId?: string; page?: string }>;

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export default async function PgrPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });

  const [listResult, companyOptions] = await Promise.all([
    listPgrAction({ companyId: sp.companyId, workUnitId: sp.workUnitId, page }),
    listCompanyOptionsAction(),
  ]);

  const { rows, total } = listResult.ok ? listResult.data : { rows: [], total: 0 };
  const companies = companyOptions.ok ? companyOptions.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="PGR"
        description="Documentos de Gerenciamento de Riscos Ocupacionais (NR-01/GRO) do escritório."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              title="Em breve (#76)"
              className="glass-panel text-text-subtle rounded-card cursor-not-allowed px-4 py-2 text-sm font-semibold"
            >
              Metodologia de Avaliação
            </button>
            <PrimaryLink href="/pgr/new">Novo PGR</PrimaryLink>
          </div>
        }
      />

      <PgrFilters
        companies={companies}
        companyId={sp.companyId}
        workUnitId={sp.workUnitId}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum PGR cadastrado ainda. Clique em “Novo PGR” para criar o primeiro documento." />
      ) : (
        <Table
          headers={["Emissão", "Validade", "Obra/Contrato", "Empresa", "Responsável", ""]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">{brDate(row.issuedAt)}</td>
              <td className="px-4 py-2">{brDate(row.validUntil)}</td>
              <td className="px-4 py-2">{row.workUnitName ?? "—"}</td>
              <td className="px-4 py-2">
                <Link href={`/pgr/${row.id}`} className="font-medium hover:underline">
                  {row.companyName}
                </Link>
              </td>
              <td className="px-4 py-2">{row.responsible ?? "—"}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/pgr/${row.id}`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Detalhe
                  </Link>
                  <Link
                    href={`/pgr/${row.id}/edit`}
                    className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
                  >
                    Editar
                  </Link>
                  <DeletePgr id={row.id} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/pgr"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ companyId: sp.companyId, workUnitId: sp.workUnitId }}
      />
    </div>
  );
}
