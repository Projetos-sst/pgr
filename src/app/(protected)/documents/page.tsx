import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { resolvePageParams } from "@/shared/pagination";
import { listDocumentsAction } from "@/shared/server/actions/documents/documents";
import type { DocumentValidityFilter } from "@/shared/domains/documents/documents";

import { EmptyState, PageHeader, Pagination, Table } from "../_ui/list";
import { BreadcrumbNav } from "./_components/breadcrumb-nav";
import { DocumentFilterBar } from "./_components/document-filter-bar";
import { DocumentKpisRow } from "./_components/document-kpis";
import { DocumentRowActions } from "./_components/document-row-actions";
import { formatMonthYearBr, VALIDITY_FILTER_OPTIONS } from "./_components/format";
import { NewFolderModal } from "./_components/new-folder-modal";
import { RenameFolderModal } from "./_components/rename-folder-modal";
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-8 sm:px-8">
      <PageHeader
        title="GED — Gestão Eletrônica de Documentos"
        description="Repositório de documentos controlados por versão e validade"
        icon={
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M3 7h6l2 2h10v11H3z" />
            <path d="M8 14h8" />
          </svg>
        }
      />

      <DocumentKpisRow kpis={view.kpis} />

      <div className="flex flex-wrap items-center justify-between gap-3">
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
                className={`rounded-pill px-3.5 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? "btn-primary shadow-primary"
                    : "glass-panel text-text-muted hover:text-text hover:bg-white/60"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-[20px]">
        {/* Sleek integrated Folder & Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 bg-white/20 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <BreadcrumbNav breadcrumb={view.breadcrumb} />

            {view.folders.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 border-l border-black/10 pl-3">
                {view.folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="glass-panel flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all hover:bg-white/80"
                  >
                    <Link
                      href={`/documents?folderId=${folder.id}`}
                      className="text-text flex items-center gap-1 transition-colors hover:text-[#5b63f5]"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#5b63f5"
                        strokeWidth="2"
                      >
                        <path d="M3 7h6l2 2h10v11H3z" />
                      </svg>
                      {folder.name}
                    </Link>
                    <RenameFolderModal folderId={folder.id} currentName={folder.name} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <NewFolderModal parentId={folderId} />
        </div>

        {/* Search & Category Filter Bar */}
        <DocumentFilterBar folderId={folderId} />

        {view.rows.length === 0 ? (
          <EmptyState message="Nenhum documento nesta localização." />
        ) : (
          <Table
            headers={[
              "CÓDIGO",
              "DOCUMENTO",
              "CATEGORIA",
              "VERSÃO",
              "VALIDADE",
              "STATUS",
              "OPÇÕES",
            ]}
          >
            {view.rows.map((doc, index) => {
              const code = `DOC-${(doc.documentGroupId || doc.id).slice(0, 4).toUpperCase()}`;
              const isEven = index % 2 === 1;
              return (
                <tr
                  key={doc.id}
                  className={`transition-colors hover:bg-white/40 ${
                    isEven ? "bg-white/20" : "bg-transparent"
                  }`}
                >
                  <td className="px-4 py-4 font-mono text-xs font-semibold text-[#5b63f5] sm:px-6 sm:text-sm">
                    {code}
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-[#1b1f2e] sm:px-6 sm:text-sm">
                    {doc.name}
                  </td>
                  <td className="text-text-muted px-4 py-4 text-xs font-medium sm:px-6 sm:text-sm">
                    {doc.docType}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs font-semibold text-[#5b63f5] sm:px-6 sm:text-sm">
                    v{doc.version}
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold sm:px-6 sm:text-sm">
                    {doc.validUntil ? (
                      <span
                        className={
                          doc.validityStatus === "ok"
                            ? "text-[#0e9f6e]"
                            : doc.validityStatus === "due_soon"
                              ? "text-[#c9820a]"
                              : doc.validityStatus === "expired"
                                ? "text-[#d33a3f]"
                                : "text-text-muted"
                        }
                      >
                        {formatMonthYearBr(doc.validUntil)}
                      </span>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <ValidityBadge status={doc.validityStatus} />
                  </td>
                  <td className="px-4 py-4 text-right sm:px-6">
                    <DocumentRowActions doc={doc} />
                  </td>
                </tr>
              );
            })}
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
    </div>
  );
}
