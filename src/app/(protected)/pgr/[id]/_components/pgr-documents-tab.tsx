"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DocumentListItem } from "@/shared/domains/documents/documents";
import { DEFAULT_COVER_COLOR } from "@/shared/domains/pgr/pgr-pdf-template";
import { enqueuePgrPdfBatchAction } from "@/shared/server/actions/documents/pdf-batch";

import { formatBytes, formatIsoDateBr } from "../../../documents/_components/format";
import { ValidityBadge } from "../../../documents/_components/validity-badge";

const COVER_COLOR_PRESETS: { value: string; label: string }[] = [
  { value: DEFAULT_COVER_COLOR, label: "Indigo" },
  { value: "#0e9f6e", label: "Verde" },
  { value: "#d33a3f", label: "Vermelho" },
  { value: "#1f2937", label: "Grafite" },
];

const ARCHIVE_QUEUED_MESSAGE =
  "Geração enfileirada. O documento aparece aqui como versão do GED assim que o worker terminar.";

function buildRelatedQuery(pgrId: string): string {
  return `relatedEntityType=pgr&relatedEntityId=${pgrId}`;
}

function SectionHeading({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-text text-base font-bold sm:text-lg">{title}</h2>
      <p className="text-text-subtle mt-1.5 max-w-2xl text-xs sm:text-sm">{children}</p>
    </div>
  );
}

/**
 * Geração do PDF do PGR. Dois caminhos, de propósito: download síncrono pela rota
 * binária (`/api/v1/pgr/[id]/pdf`, issue #40) e arquivamento assíncrono, que enfileira
 * o job `pdf_batch` (#39) e vira documento versionado do GED vinculado a este PGR.
 */
function PgrPdfPanel({ pgrId }: { pgrId: string }) {
  const router = useRouter();
  const [coverColor, setCoverColor] = useState(DEFAULT_COVER_COLOR);
  const [isArchivePending, startArchive] = useTransition();
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const pdfHref = `/api/v1/pgr/${pgrId}/pdf?color=${encodeURIComponent(coverColor)}`;

  function handleArchive() {
    startArchive(async () => {
      setArchiveError(null);
      setArchiveNotice(null);
      const result = await enqueuePgrPdfBatchAction([pgrId]);
      if (!result.ok) {
        setArchiveError(result.error.message);
        return;
      }
      setArchiveNotice(ARCHIVE_QUEUED_MESSAGE);
      router.refresh();
    });
  }

  return (
    <section className="glass-card flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        </div>
        <SectionHeading title="Geração do PDF do PGR">
          Monta capa, sumário, inventário de riscos e plano de ação a partir da visão
          consolidada. <strong>Baixar agora</strong> gera na hora e não guarda cópia;{" "}
          <strong>Arquivar no GED</strong> registra o PDF como documento versionado deste
          PGR.
        </SectionHeading>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-text-subtle text-xs font-semibold">Cor da capa</legend>
          <div className="flex flex-wrap items-center gap-2">
            {COVER_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setCoverColor(preset.value)}
                aria-pressed={coverColor === preset.value}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
                  coverColor === preset.value
                    ? "bg-white/70 shadow-sm"
                    : "text-text-subtle bg-white/30 hover:bg-white/50"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: preset.value }}
                />
                {preset.label}
              </button>
            ))}
            <input
              type="color"
              value={coverColor}
              onChange={(event) => setCoverColor(event.target.value)}
              aria-label="Cor personalizada da capa"
              className="h-8 w-10 cursor-pointer rounded-lg border border-black/10 bg-transparent p-0.5"
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={pdfHref}
            className="btn-primary shadow-primary rounded-card flex w-fit items-center gap-2 px-4 py-2.5 text-xs font-bold text-white sm:text-sm"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5M12 15V3" />
            </svg>
            Baixar agora
          </a>
          <button
            type="button"
            onClick={handleArchive}
            disabled={isArchivePending}
            className="glass-panel text-text-muted hover:text-text rounded-card w-fit px-4 py-2.5 text-xs font-bold transition-colors disabled:opacity-60 sm:text-sm"
          >
            {isArchivePending ? "Enfileirando…" : "Arquivar no GED"}
          </button>
        </div>
      </div>

      {archiveNotice ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-800"
        >
          {archiveNotice}
        </p>
      ) : null}
      {archiveError ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-800"
        >
          {archiveError}
        </p>
      ) : null}
    </section>
  );
}

/** Acervo do GED ligado a este PGR pela relação polimórfica (`related_entity_type`). */
function PgrLinkedDocumentsPanel({
  pgrId,
  pgrLabel,
  linkedDocuments,
  linkedTotal,
}: {
  pgrId: string;
  pgrLabel: string;
  linkedDocuments: DocumentListItem[];
  linkedTotal: number;
}) {
  const relatedQuery = buildRelatedQuery(pgrId);
  const attachQuery =
    `${relatedQuery}` +
    `&returnTo=${encodeURIComponent(`/pgr/${pgrId}`)}` +
    `&returnLabel=${encodeURIComponent(pgrLabel)}`;

  return (
    <section className="glass-card flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading title="Documentos vinculados no GED">
          Anexos ligados a este PGR — laudos, ARTs, evidências. O acervo completo fica no
          módulo de Documentos.
        </SectionHeading>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/documents/new?${attachQuery}`}
            className="btn-primary rounded-card px-4 py-2 text-xs font-bold text-white"
          >
            Anexar documento
          </Link>
          <Link
            href={`/documents?${relatedQuery}`}
            className="glass-panel text-text-muted hover:text-text rounded-card px-4 py-2 text-xs font-bold transition-colors"
          >
            Abrir no GED
          </Link>
        </div>
      </div>

      {linkedDocuments.length > 0 ? (
        <ul className="grid gap-2">
          {linkedDocuments.map((document) => (
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
          Nenhum documento foi vinculado a este PGR ainda.
        </p>
      )}

      {linkedTotal > linkedDocuments.length ? (
        <Link
          href={`/documents?${relatedQuery}`}
          className="text-primary w-fit text-xs font-bold hover:underline"
        >
          Ver todos os {linkedTotal} documentos vinculados →
        </Link>
      ) : null}
    </section>
  );
}

/** Etapa "Documentos e PDF" do editor de PGR — compõe os dois painéis. */
export function PgrDocumentsTab({
  pgrId,
  pgrLabel,
  linkedDocuments,
  linkedTotal,
}: {
  pgrId: string;
  pgrLabel: string;
  linkedDocuments: DocumentListItem[];
  linkedTotal: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PgrPdfPanel pgrId={pgrId} />
      <PgrLinkedDocumentsPanel
        pgrId={pgrId}
        pgrLabel={pgrLabel}
        linkedDocuments={linkedDocuments}
        linkedTotal={linkedTotal}
      />
    </div>
  );
}
