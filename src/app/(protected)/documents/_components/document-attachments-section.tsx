import Link from "next/link";

import { listDocumentsAction } from "@/shared/server/actions/documents/documents";
import type { DocumentRelatedEntityType } from "@/shared/domains/documents/validity";

import { formatBytes, formatIsoDateBr } from "./format";
import { ValidityBadge } from "./validity-badge";

const ATTACHMENTS_PAGE_SIZE = 5;

/**
 * Seção "Anexos" reutilizável por qualquer tela de entidade vinculável do GED
 * (issue #45) — hoje PGR (`pgr-documents-tab.tsx`, painel próprio por já ter o
 * fluxo de arquivamento de PDF), GES e Risco. Lista os documentos vinculados
 * via `related_entity_type/related_entity_id` e oferece o atalho de anexar.
 * `responsible_technician` fica de fora: ainda não existe cadastro (issue #36).
 */
export async function DocumentAttachmentsSection({
  relatedEntityType,
  relatedEntityId,
  attachHref,
  title = "Anexos",
  description = "Documentos vinculados a este registro — laudos, ARTs, evidências.",
}: {
  relatedEntityType: DocumentRelatedEntityType;
  relatedEntityId: string;
  attachHref: string;
  title?: string;
  description?: string;
}) {
  const result = await listDocumentsAction({
    relatedEntityType,
    relatedEntityId,
    pageSize: ATTACHMENTS_PAGE_SIZE,
  });
  const documents = result.ok ? result.data.rows : [];
  const total = result.ok ? result.data.total : 0;
  const relatedQuery = `relatedEntityType=${relatedEntityType}&relatedEntityId=${relatedEntityId}`;

  return (
    <section className="glass-card flex flex-col gap-4 p-4">
      <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-text text-lg font-semibold">{title}</h2>
          <p className="text-text-subtle text-sm">{description}</p>
        </div>
        <Link
          href={attachHref}
          className="btn-primary rounded-pill px-4 py-1.5 text-sm font-semibold"
        >
          Anexar Documento
        </Link>
      </header>

      {documents.length === 0 ? (
        <p className="text-text-subtle text-sm">Nenhum documento vinculado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="glass-panel rounded-card flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-text truncate text-sm font-semibold">
                  {document.name}
                </p>
                <p className="text-text-subtle mt-0.5 font-mono text-[11px] tracking-wide uppercase">
                  {document.docType} · v{document.version} ·{" "}
                  {formatBytes(document.sizeBytes)}
                  {document.validUntil
                    ? ` · vence em ${formatIsoDateBr(document.validUntil)}`
                    : ""}
                </p>
              </div>
              <ValidityBadge status={document.validityStatus} />
            </li>
          ))}
        </ul>
      )}

      {total > documents.length ? (
        <Link
          href={`/documents?${relatedQuery}`}
          className="text-primary w-fit text-xs font-bold hover:underline"
        >
          Ver todos os {total} documentos vinculados →
        </Link>
      ) : null}
    </section>
  );
}
