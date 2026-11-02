import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { searchProceduresAction } from "@/shared/server/actions/medicine/exam-proposal";

import { EmptyState, PageHeader } from "../../_ui/list";
import {
  Cell,
  DataGrid,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  MonoCell,
  ToolbarSearch,
} from "../../_ui/data-list";
import { ListErrorState, hrefWithParams } from "../../_ui/list-error-state";

export const dynamic = "force-dynamic";

const TEMPLATE = "110px 1fr";

type SearchParams = Promise<{ search?: string; page?: string }>;

/** Catálogo de referência (Tabela 27 do eSocial): consulta, sem cadastro nem edição. */
export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const result = await searchProceduresAction(sp.search ?? "", { page });
  const retryHref = hrefWithParams("/medicine/procedures", {
    search: sp.search,
    page: sp.page,
  });

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        title="Procedimentos diagnósticos"
        backHref="/medicine"
        description="Tabela 27 do eSocial, importada do anexo oficial. Somente consulta: os códigos não podem ser criados nem alterados aqui."
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/medicine/procedures"
            placeholder="Buscar por código ou descrição…"
            defaultValue={sp.search}
          />
        </ListToolbar>

        {!result.ok ? (
          <ListErrorState
            isFlat
            code={result.error.code}
            title="Não foi possível carregar o catálogo"
            description="Tente novamente."
            retryHref={retryHref}
          />
        ) : result.data.rows.length === 0 ? (
          <div className="p-6">
            <EmptyState isFlat message="Nenhum procedimento encontrado para a busca." />
          </div>
        ) : (
          <>
            <DataGrid minWidth={560}>
              <GridHeader
                template={TEMPLATE}
                columns={[{ header: "Código" }, { header: "Procedimento" }]}
              />
              {result.data.rows.map((row, i) => (
                <GridRow key={row.code} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell>{row.code}</MonoCell>
                  <Cell className="text-text">{row.description}</Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/medicine/procedures"
              page={page}
              pageSize={pageSize}
              total={result.data.total}
              params={{ search: sp.search }}
            />
            <p className="text-text-subtle px-5 pb-4 text-xs">
              Fonte: {result.data.source.source} · versão {result.data.source.version} ·
              importado em {result.data.source.importedOn}.
            </p>
          </>
        )}
      </ListCard>
    </div>
  );
}
