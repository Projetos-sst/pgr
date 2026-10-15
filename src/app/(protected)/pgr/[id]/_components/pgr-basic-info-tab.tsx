import Link from "next/link";

import { pgrRegistrationTypeLabel, type Pgr } from "@/shared/domains/pgr/pgr";
import type { DocumentListItem } from "@/shared/domains/documents/documents";

import { formatBytes, formatIsoDateBr } from "../../../documents/_components/format";
import { ValidityBadge } from "../../../documents/_components/validity-badge";

function Field({
  label,
  value,
  isMono,
}: {
  label: string;
  value: string | null | undefined;
  isMono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-1">
      <span className="text-text-subtle font-mono text-[10px] font-bold tracking-wider uppercase">
        {label}
      </span>
      <span
        className={`text-text text-sm font-semibold ${isMono ? "font-mono text-xs" : ""}`}
      >
        {value && value !== "" ? value : "—"}
      </span>
    </div>
  );
}

const brDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

/**
 * Anexo da ART do Responsável Técnico (issue #36). `responsible_technician` não é uma
 * entidade própria — é um grupo de colunas na própria tabela `pgr` — então o vínculo
 * polimórfico usa o **id do próprio PGR** como `relatedEntityId` (mesmo mecanismo do
 * acervo geral do PGR em `pgr-documents-tab.tsx`, só trocando `relatedEntityType`).
 */
function ResponsibleTechnicianDocumentsPanel({
  pgrId,
  technicianLabel,
  documents,
  total,
}: {
  pgrId: string;
  technicianLabel: string;
  documents: DocumentListItem[];
  total: number;
}) {
  const relatedQuery = `relatedEntityType=responsible_technician&relatedEntityId=${pgrId}`;
  const attachQuery =
    `${relatedQuery}` +
    `&returnTo=${encodeURIComponent(`/pgr/${pgrId}`)}` +
    `&returnLabel=${encodeURIComponent(technicianLabel)}`;

  return (
    <div className="glass-card flex flex-col gap-5 p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-text text-base font-bold sm:text-lg">
            ART do Responsável Técnico
          </h2>
          <p className="text-text-subtle mt-1.5 max-w-2xl text-xs sm:text-sm">
            Anotação de Responsabilidade Técnica e outros anexos do responsável pela
            elaboração deste PGR.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/documents/new?${attachQuery}`}
            className="btn-primary rounded-card px-4 py-2 text-xs font-bold text-white"
          >
            Anexar ART
          </Link>
          <Link
            href={`/documents?${relatedQuery}`}
            className="glass-panel text-text-muted hover:text-text rounded-card px-4 py-2 text-xs font-bold transition-colors"
          >
            Abrir no GED
          </Link>
        </div>
      </div>

      {documents.length > 0 ? (
        <ul className="grid gap-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="glass-panel flex flex-col gap-2 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-text truncate text-sm font-bold">{document.name}</p>
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
      ) : (
        <p className="text-text-subtle rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-xs">
          Nenhuma ART anexada ainda.
        </p>
      )}

      {total > documents.length ? (
        <Link
          href={`/documents?${relatedQuery}`}
          className="text-primary w-fit text-xs font-bold hover:underline"
        >
          Ver todos os {total} documentos vinculados →
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Aba Informações básicas: exibe os campos cadastrais reais do `pgr`.
 */
export function PgrBasicInfoTab({
  pgrId,
  pgr,
  companyName,
  workUnitName,
  technicianDocuments,
  technicianDocumentsTotal,
  readOnly = false,
}: {
  pgrId: string;
  pgr: Pgr;
  companyName: string;
  workUnitName: string | null;
  technicianDocuments: DocumentListItem[];
  technicianDocumentsTotal: number;
  readOnly?: boolean;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="glass-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-text text-base font-bold sm:text-lg">
            Identificação do Documento
          </h2>
          <p className="text-text-subtle mt-0.5 text-xs">
            Dados cadastrais e responsável técnico pela elaboração do PGR
          </p>
        </div>
        {!readOnly ? (
          <Link
            href={`/pgr/${pgrId}/edit`}
            className="glass-panel text-text-muted hover:text-text flex items-center justify-center gap-2 rounded-[12px] px-4 py-2 text-xs font-bold transition-all sm:text-sm"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar informações
          </Link>
        ) : null}
      </div>

      <div className="glass-card grid gap-6 p-6 sm:grid-cols-3">
        <Field label="Empresa" value={companyName} />
        <Field label="Obra / Contrato" value={workUnitName ?? "Sem obra específica"} />
        <Field label="Responsável Técnico" value={pgr.responsible} />
        <Field
          label="Tipo de registro"
          value={pgrRegistrationTypeLabel(pgr.registrationType)}
        />
        <Field label="Nº do registro" value={pgr.registrationNumber} isMono />
        <Field label="Data de emissão" value={brDate(pgr.issuedAt)} isMono />
        <Field label="Data de validade" value={brDate(pgr.validUntil)} isMono />
      </div>

      <ResponsibleTechnicianDocumentsPanel
        pgrId={pgrId}
        technicianLabel={
          pgr.responsible ? `RT ${pgr.responsible}` : "o Responsável Técnico"
        }
        documents={technicianDocuments}
        total={technicianDocumentsTotal}
      />
    </section>
  );
}
