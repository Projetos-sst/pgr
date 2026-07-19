import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listDocumentsAction } from "@/shared/server/actions/documents/documents";
import type { DocumentValidityFilter } from "@/shared/domains/documents/documents";

import {
  EmptyState,
  PageHeader,
  Pagination,
  PrimaryLink,
  SearchForm,
  Table,
} from "../_ui/list";
import { BreadcrumbNav } from "./_components/breadcrumb-nav";
import { DocumentKpisRow } from "./_components/document-kpis";
import { DocumentRowActions } from "./_components/document-row-actions";
import {
  formatBytes,
  formatDateTimeBr,
  formatIsoDateBr,
  VALIDITY_FILTER_OPTIONS,
} from "./_components/format";
import { FolderPanel } from "./_components/folder-panel";
import { ValidityBadge } from "./_components/validity-badge";

export const dynamic = "force-dynamic";

const VALIDITY_VALUES = new Set(["ok", "due_soon", "expired", "no_expiry"]);

function parseValidity(value?: string): DocumentValidityFilter | undefined {
  return VALIDITY_VALUES.has(value ?? "") ? (value as DocumentValidityFilter) : undefined;
}

type SearchParams = Promise<{
  folderId?: string;
  search?: string;
  docType?: string;
  validity?: string;
  page?: string;
}>;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  const folderId = sp.folderId && sp.folderId !== "" ? sp.folderId : null;
  const validity = parseValidity(sp.validity);
  const { page, pageSize } = resolvePageParams({
    page: sp.page ? Number(sp.page) : undefined,
  });

  const result = await listDocumentsAction({
    folderId,
    search: sp.search,
    docType: sp.docType,
    validity,
    page,
  });

  const view = result.ok
    ? result.data
    : {
        rows: [],
        total: 0,
        kpis: { documents: 0, folders: 0, dueSoon: 0, expired: 0 },
        folders: [],
        breadcrumb: [{ id: null, name: "Início" }],
      };

  const hiddenParams = {
    folderId: sp.folderId,
    docType: sp.docType,
    validity: sp.validity,
  };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Documentos"
        description="Acervo de documentos do escritório — laudos, contratos, fichas e demais arquivos."
        action={
          <PrimaryLink
            href={folderId ? `/documents/new?folderId=${folderId}` : "/documents/new"}
          >
            Novo documento
          </PrimaryLink>
        }
      />

      <DocumentKpisRow kpis={view.kpis} />

      <BreadcrumbNav breadcrumb={view.breadcrumb} />

      <FolderPanel folders={view.folders} currentFolderId={folderId} />

      <div className="flex flex-wrap items-center gap-2">
        {VALIDITY_FILTER_OPTIONS.map((option) => {
          const active = (sp.validity ?? "") === option.value;
          const query = new URLSearchParams();
          if (option.value) query.set("validity", option.value);
          if (sp.folderId) query.set("folderId", sp.folderId);
          if (sp.search) query.set("search", sp.search);
          if (sp.docType) query.set("docType", sp.docType);
          const qs = query.toString();
          return (
            <Link
              key={option.label}
              href={`/documents${qs ? `?${qs}` : ""}`}
              className={`rounded-pill px-3 py-1 text-sm font-semibold transition-colors ${
                active ? "btn-primary" : "glass-panel text-text-muted hover:text-text"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <SearchForm
        basePath="/documents"
        placeholder="Buscar por nome"
        defaultValue={sp.search}
        hidden={hiddenParams}
      />

      {view.rows.length === 0 ? (
        <EmptyState message="Nenhum documento nesta pasta." />
      ) : (
        <Table
          headers={[
            "Nome",
            "Tipo",
            "Versão",
            "Tamanho",
            "Criado",
            "Vencimento",
            "Status",
            "",
          ]}
        >
          {view.rows.map((doc) => (
            <tr key={doc.id} className="border-t border-white/50">
              <td className="px-4 py-2 font-medium">📄 {doc.name}</td>
              <td className="px-4 py-2">{doc.docType}</td>
              <td className="px-4 py-2 tabular-nums">v{doc.version}</td>
              <td className="px-4 py-2 tabular-nums">{formatBytes(doc.sizeBytes)}</td>
              <td className="px-4 py-2 tabular-nums">
                {formatDateTimeBr(doc.createdAt)}
              </td>
              <td className="px-4 py-2 tabular-nums">
                {doc.validUntil ? formatIsoDateBr(doc.validUntil) : "—"}
              </td>
              <td className="px-4 py-2">
                <ValidityBadge status={doc.validityStatus} />
              </td>
              <td className="px-4 py-2">
                <DocumentRowActions doc={doc} />
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination
        basePath="/documents"
        page={page}
        pageSize={pageSize}
        total={view.total}
        params={hiddenParams}
      />
    </div>
  );
}
