import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listFormControlsAction } from "@/shared/server/actions/documents/form-controls";
import {
  FORM_CONTROL_STATUSES,
  formControlStatusLabel,
  formControlStatusTone,
} from "@/shared/domains/documents/form-controls";

import {
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  MonoCell,
  RowActions,
  StatusBadge,
  ToolbarButton,
  ToolbarSearch,
  ToolbarSelect,
} from "../_ui/data-list";
import { EmptyState, PageHeader } from "../_ui/list";
import { DeleteFormControl } from "./_components/delete-form-control";
import { FormControlIcon } from "./_components/form-control-icon";

export const dynamic = "force-dynamic";

const TEMPLATE = "1fr 1.8fr 1.2fr 1fr 1.2fr 1.1fr 84px";

const STATUS_OPTIONS = FORM_CONTROL_STATUSES.map((value) => ({
  value,
  label: formControlStatusLabel(value),
}));

type SearchParams = Promise<{ search?: string; status?: string; page?: string }>;

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
  const result = await listFormControlsAction({
    search: sp.search,
    status: sp.status,
    page,
  });
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<FormControlIcon />}
        title="Controle de formulários"
        description="Cabeçalhos ISO (FRM/REV/N.C.) usados na geração dos documentos"
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/form-controls"
            placeholder="Buscar por código FRM ou formulário…"
            defaultValue={sp.search}
            hidden={{ status: sp.status }}
          />
          <ToolbarSelect
            basePath="/form-controls"
            name="status"
            defaultValue={sp.status}
            options={STATUS_OPTIONS}
            emptyLabel="Todos os status"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href="/form-controls/new">Novo Controle</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message={
                sp.search
                  ? "Nenhum controle encontrado para a busca."
                  : "Nenhum controle de formulário cadastrado."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={900}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Código" },
                  { header: "Formulário" },
                  { header: "Tipo" },
                  { header: "Versão" },
                  { header: "Atualizado em" },
                  { header: "Status" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => (
                <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                  <MonoCell href={`/form-controls/${row.id}/edit`}>
                    {row.frmCode}
                  </MonoCell>
                  <Cell className="text-text font-semibold">{row.formType}</Cell>
                  <Cell>{row.typeLabel}</Cell>
                  <Cell className="text-text-muted font-mono">{row.revision}</Cell>
                  <Cell className="text-text-muted font-mono">{row.issueDate}</Cell>
                  <Cell>
                    <StatusBadge tone={formControlStatusTone(row.status)}>
                      {row.statusLabel}
                    </StatusBadge>
                  </Cell>
                  <Cell align="right">
                    <RowActions>
                      <EditIconLink href={`/form-controls/${row.id}/edit`} />
                      <DeleteFormControl id={row.id} />
                    </RowActions>
                  </Cell>
                </GridRow>
              ))}
            </DataGrid>
            <ListFooter
              basePath="/form-controls"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ search: sp.search, status: sp.status }}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
