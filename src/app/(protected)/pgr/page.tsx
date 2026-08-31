import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  classifyDocumentValidity,
  type DocumentValidityStatus,
} from "@/shared/domains/documents/validity";
import {
  pgrRegistrationTypeSchema,
  pgrRegistrationTypeLabel,
} from "@/shared/domains/pgr/pgr";
import { listPgrAction } from "@/shared/server/actions/pgr/pgr";
import { listTeamMembers } from "@/shared/server/actions/platform/team";

import Link from "next/link";

import { EmptyState, PageHeader } from "../_ui/list";
import {
  Cell,
  DataGrid,
  EditIconLink,
  GridHeader,
  GridRow,
  ListCard,
  ListFooter,
  ListToolbar,
  ToolbarButton,
  ToolbarSearch,
  ToolbarSelect,
} from "../_ui/data-list";
import { DeletePgr } from "./_components/delete-pgr";

/** Ícone lápis (editar) — mesma moldura do EditIconLink (olho). */
function PencilEditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Editar"
      title="Editar"
      className="text-primary flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors hover:bg-white/50"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </Link>
  );
}

export const dynamic = "force-dynamic";

const TEMPLATE = "1fr 1fr 1.5fr 1.6fr 1.5fr 1.2fr 110px";

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

/** Cor da Validade derivada na leitura (verde/âmbar/vermelho/cinza). */
const VALIDITY_COLOR: Record<DocumentValidityStatus, string> = {
  ok: "text-accent-green font-semibold",
  due_soon: "text-accent-amber-strong font-semibold",
  expired: "text-danger font-semibold",
  no_expiry: "text-text-subtle",
};

const TYPE_OPTIONS = pgrRegistrationTypeSchema.options.map((value) => ({
  value,
  label: pgrRegistrationTypeLabel(value),
}));

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

type SearchParams = Promise<{
  search?: string;
  registrationType?: string;
  page?: string;
}>;

export default async function PgrPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });
  const registrationType = pgrRegistrationTypeSchema.safeParse(sp.registrationType);
  const today = todayInSaoPaulo();

  const [listResult, teamResult] = await Promise.all([
    listPgrAction({
      search: sp.search,
      registrationType: registrationType.success ? registrationType.data : undefined,
      page,
    }),
    // Nomes dos autores (coluna "Usuário") — resolvidos na página via roster do time
    // (action gated; `users` tem RLS própria). Fora do `listPgrAction` para não
    // acoplar a listagem ao admin client. Se falhar, a coluna mostra "—".
    listTeamMembers({ pageSize: 1000 }),
  ]);
  const { rows, total } = listResult.ok ? listResult.data : { rows: [], total: 0 };
  const nameById = new Map<string, string>(
    teamResult.ok ? teamResult.data.rows.map((m) => [m.userId, m.name]) : [],
  );
  const params = { search: sp.search, registrationType: sp.registrationType };

  return (
    <div className="flex flex-col gap-[22px] px-[30px] pt-8 pb-10">
      <PageHeader
        icon={<ShieldIcon />}
        title="PGR"
        description={`Programas de Gerenciamento de Riscos (NR-01/GRO) — ${total} documento(s).`}
        action={
          <button
            type="button"
            disabled
            title="Em breve (#76)"
            className="glass-panel text-text-subtle rounded-card cursor-not-allowed px-4 py-2 text-sm font-semibold"
          >
            Metodologia de Avaliação
          </button>
        }
      />

      <ListCard>
        <ListToolbar>
          <ToolbarSearch
            basePath="/pgr"
            placeholder="Buscar por empresa ou obra/local…"
            defaultValue={sp.search}
            hidden={{ registrationType: sp.registrationType }}
          />
          <ToolbarSelect
            basePath="/pgr"
            name="registrationType"
            defaultValue={sp.registrationType}
            options={TYPE_OPTIONS}
            emptyLabel="Todos os Tipos"
            hidden={{ search: sp.search }}
          />
          <ToolbarButton href="/pgr/new">Novo</ToolbarButton>
        </ListToolbar>

        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              isFlat
              message={
                sp.search || sp.registrationType
                  ? "Nenhum PGR encontrado para os filtros."
                  : "Nenhum PGR cadastrado ainda. Clique em “Novo” para criar o primeiro."
              }
            />
          </div>
        ) : (
          <>
            <DataGrid minWidth={980}>
              <GridHeader
                template={TEMPLATE}
                columns={[
                  { header: "Emissão" },
                  { header: "Validade" },
                  { header: "Obra / Contrato" },
                  { header: "Empresa" },
                  { header: "Responsável" },
                  { header: "Usuário" },
                  { header: "Opções", align: "right" },
                ]}
              />
              {rows.map((row, i) => {
                const validity = classifyDocumentValidity(row.validUntil, {
                  today,
                  dueWindowDays: 30,
                });
                return (
                  <GridRow key={row.id} template={TEMPLATE} striped={i % 2 === 1}>
                    <Cell>{brDate(row.issuedAt)}</Cell>
                    <Cell className={VALIDITY_COLOR[validity]}>
                      {brDate(row.validUntil)}
                    </Cell>
                    <Cell className={row.workUnitName ? undefined : "text-text-subtle"}>
                      {row.workUnitName ?? "—"}
                    </Cell>
                    <Cell className="text-text font-semibold">{row.companyName}</Cell>
                    <Cell className={row.responsible ? undefined : "text-text-subtle"}>
                      {row.responsible ?? "—"}
                    </Cell>
                    <Cell
                      className={
                        row.createdBy && nameById.has(row.createdBy)
                          ? undefined
                          : "text-text-subtle"
                      }
                    >
                      {(row.createdBy && nameById.get(row.createdBy)) ?? "—"}
                    </Cell>
                    <Cell align="right">
                      <span className="flex items-center justify-end gap-1">
                        <EditIconLink href={`/pgr/${row.id}`} />
                        <PencilEditLink href={`/pgr/${row.id}/edit`} />
                        <DeletePgr id={row.id} />
                      </span>
                    </Cell>
                  </GridRow>
                );
              })}
            </DataGrid>
            <ListFooter
              basePath="/pgr"
              page={page}
              pageSize={pageSize}
              total={total}
              params={params}
            />
          </>
        )}
      </ListCard>
    </div>
  );
}
