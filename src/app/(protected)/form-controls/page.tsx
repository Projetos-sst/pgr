import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listFormControlsAction } from "@/shared/server/actions/documents/form-controls";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { EditRowAction, RowActions } from "../_ui/row-actions";
import { DeleteFormControl } from "./_components/delete-form-control";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function FormControlsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await listFormControlsAction({ search: sp.search, page });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Controle de formulário"
        description="Cabeçalhos ISO (FRM/REV/N.C.) usados na geração dos documentos do escritório."
        action={<PrimaryLink href="/form-controls/new">Novo controle</PrimaryLink>}
      />
      <SearchForm
        basePath="/form-controls"
        placeholder="Buscar por código FRM ou tipo"
        defaultValue={sp.search}
      />

      {rows.length === 0 ? (
        <EmptyState message="Nenhum controle de formulário cadastrado." />
      ) : (
        <Table headers={["Tipo", "Código FRM", "REV", "Data", "Posicionamento", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/50">
              <td className="px-4 py-2">
                <Link
                  href={`/form-controls/${row.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {row.formType}
                </Link>
              </td>
              <td className="px-4 py-2">{row.frmCode}</td>
              <td className="px-4 py-2">{row.revision}</td>
              <td className="px-4 py-2 tabular-nums">{row.issueDate}</td>
              <td className="px-4 py-2">{row.positionLabel}</td>
              <td className="px-4 py-2">
                <RowActions>
                  <EditRowAction href={`/form-controls/${row.id}/edit`} />
                  <DeleteFormControl id={row.id} />
                </RowActions>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/form-controls"
        page={page}
        pageSize={pageSize}
        total={total}
        params={{ search: sp.search }}
      />
    </div>
  );
}
