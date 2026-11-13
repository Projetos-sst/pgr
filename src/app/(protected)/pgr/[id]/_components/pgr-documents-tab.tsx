"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DocumentListItem } from "@/shared/domains/documents/documents";
import {
  nr18StatusLabel,
  nr18StatusTone,
  type Nr18ChecklistSummary,
} from "@/shared/domains/documents/nr18";
import {
  EPI_RELATION_EMPTY_LABEL,
  EPI_RELATION_SOURCE_NOTE,
  epiCaStatusLabel,
  epiCaStatusTone,
  formatEpiSpecs,
  type PgrEpiRelationItem,
} from "@/shared/domains/pgr/epi-relation";
import { enqueuePgrPdfBatchAction } from "@/shared/server/actions/documents/pdf-batch";
import { PgrReadinessPanel } from "./pgr-readiness-panel";

import { Cell, DataGrid, GridHeader, GridRow, StatusBadge } from "../../../_ui/data-list";
import { formatBytes, formatIsoDateBr } from "../../../documents/_components/format";
import { ValidityBadge } from "../../../documents/_components/validity-badge";

const ARCHIVE_QUEUED_MESSAGE =
  "Geração enfileirada. O PDF aparece aqui como versão do GED assim que o processamento terminar.";
const ARCHIVE_FAILED_MESSAGE = "Não foi possível enfileirar a geração. Tente novamente.";

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
 * Geração do documento do PGR a partir do template DOCX (`templates/pgr`). Dois caminhos,
 * de propósito: download síncrono pela rota binária (`/api/v1/pgr/[id]/docx`, DOCX ou PDF
 * derivado dele) e arquivamento assíncrono, que enfileira o job `pdf_batch` (#39) e vira
 * documento versionado do GED vinculado a este PGR.
 */
function PgrPdfPanel({ pgrId }: { pgrId: string }) {
  const router = useRouter();
  const [isArchivePending, setIsArchivePending] = useState(false);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const docxHref = `/api/v1/pgr/${pgrId}/docx?format=docx`;
  const pdfHref = `/api/v1/pgr/${pgrId}/docx?format=pdf`;

  async function handleArchive() {
    setArchiveError(null);
    setArchiveNotice(null);
    setIsArchivePending(true);
    try {
      const result = await enqueuePgrPdfBatchAction([pgrId]);
      if (!result.ok) {
        setArchiveError(result.error.message);
        return;
      }
      setArchiveNotice(ARCHIVE_QUEUED_MESSAGE);
    } catch {
      setArchiveError(ARCHIVE_FAILED_MESSAGE);
      return;
    } finally {
      setIsArchivePending(false);
    }
    router.refresh();
  }

  return (
    <section className="glass-card flex flex-col gap-5 p-6 sm:p-8">
      <PgrReadinessPanel pgrId={pgrId} />
      <Link href={`/pgr/${pgrId}/reviews`} className="text-primary underline">
        Amostras, pareceres recebidos e revalidação técnica
      </Link>
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
        <SectionHeading title="Geração do documento do PGR">
          Gere o documento com os dados cadastrados neste PGR (empresa, GES, riscos, plano
          de ação, EPIs e treinamentos). <strong>Baixar DOCX</strong> e{" "}
          <strong>Baixar PDF</strong> geram uma prévia na hora, sem guardar cópia e sem
          valor de emissão; <strong>Arquivar no GED</strong> salva o PDF como versão no
          acervo deste PGR. A emissão assinada é feita na etapa 5 (Assinatura).
        </SectionHeading>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={docxHref}
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
          Baixar DOCX
        </a>
        <a
          href={pdfHref}
          className="glass-panel text-text-muted hover:text-text rounded-card flex w-fit items-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors sm:text-sm"
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
          Baixar PDF
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
              // `min-w-0`: item de grid não encolhe abaixo do min-content por
              // padrão, e o nome longo do documento empurrava a página no 375px.
              className="glass-panel flex min-w-0 flex-col gap-2 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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

/**
 * Checklist NR-18 (item 18.4.3) — issue #48. **Informativo**: mostra o que já está
 * anexado e o que falta, com atalho de upload já com o tipo e o vínculo preenchidos.
 * Não bloqueia PDF, assinatura nem publicação. Só aparece quando a unidade do PGR é
 * do tipo Obra/Canteiro.
 */
function PgrNr18Panel({
  pgrId,
  pgrLabel,
  checklist,
}: {
  pgrId: string;
  pgrLabel: string;
  checklist: Nr18ChecklistSummary;
}) {
  const template = "1.8fr 1fr 1.6fr 0.9fr";
  const attachHref = (docType: string) =>
    `/documents/new?${buildRelatedQuery(pgrId)}` +
    `&docType=${encodeURIComponent(docType)}` +
    `&returnTo=${encodeURIComponent(`/pgr/${pgrId}`)}` +
    `&returnLabel=${encodeURIComponent(pgrLabel)}`;

  return (
    <section className="glass-card flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading title="Documentos complementares (NR-18)">
          Projetos exigidos para o canteiro de obra. O checklist é informativo — ele{" "}
          <strong>não</strong> bloqueia a geração do PDF nem a assinatura do PGR. Cada
          documento é anexado ao acervo, com versionamento.
        </SectionHeading>
        <span className="text-text-subtle shrink-0 font-mono text-[11px] tracking-wide uppercase">
          {checklist.attachedCount} de {checklist.totalCount} anexados
        </span>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-black/5">
        <DataGrid minWidth={760}>
          <GridHeader
            template={template}
            columns={[
              { header: "Documento" },
              { header: "Situação", align: "center" },
              { header: "Documento vigente" },
              { header: "Ação", align: "center" },
            ]}
          />
          {checklist.items.map((item, i) => (
            <GridRow key={item.key} template={template} striped={i % 2 === 1}>
              <Cell className="text-text font-semibold">
                {item.label}
                <span className="text-text-subtle block text-[11px] font-normal">
                  {item.description}
                </span>
              </Cell>
              <Cell align="center">
                <span className="flex justify-center">
                  <StatusBadge tone={nr18StatusTone(item)}>
                    {nr18StatusLabel(item)}
                  </StatusBadge>
                </span>
              </Cell>
              <Cell className="text-text-muted">
                {item.documents.length > 0
                  ? item.documents
                      .map((doc) => `${doc.name} (v${doc.version})`)
                      .join(", ")
                  : "—"}
              </Cell>
              <Cell align="center">
                <Link
                  href={attachHref(item.label)}
                  className="text-primary text-xs font-bold hover:underline"
                >
                  {item.attached ? "Anexar outro" : "Anexar"}
                </Link>
              </Cell>
            </GridRow>
          ))}
        </DataGrid>
      </div>
    </section>
  );
}

/**
 * Relação de EPIs do PGR (#48, decisão Q4 = A) — **somente leitura**. A fonte é o
 * cadastro de EPI vinculado aos riscos; não há digitação paralela nem botão de editar
 * aqui. Um EPI que atende vários riscos aparece uma vez, com os contextos agrupados.
 */
function PgrEpiRelationPanel({ items }: { items: PgrEpiRelationItem[] }) {
  // Largura mínima calibrada para caber na coluna do editor de PGR (~915px no 1440):
  // acima disso a coluna "Riscos / GES" ficava cortada mesmo com scroll interno.
  const template = "1.3fr 1fr 0.9fr 0.9fr 1.2fr 1.4fr";

  return (
    <section className="glass-card flex flex-col gap-5 p-6 sm:p-8">
      <SectionHeading title="Relação de EPIs">
        {EPI_RELATION_SOURCE_NOTE} Para alterar qualquer dado, edite o item no{" "}
        <Link href="/epi-catalog" className="text-primary font-bold hover:underline">
          catálogo de EPI
        </Link>
        .
      </SectionHeading>

      {items.length === 0 ? (
        <p className="text-text-subtle rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-xs">
          {EPI_RELATION_EMPTY_LABEL}
        </p>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-black/5">
          <DataGrid minWidth={860}>
            <GridHeader
              template={template}
              columns={[
                { header: "EPI" },
                { header: "CA", align: "center" },
                { header: "Fabricante", align: "center" },
                { header: "Norma", align: "center" },
                { header: "Especificações", align: "center" },
                { header: "Riscos / GES atendidos" },
              ]}
            />
            {items.map((item, i) => (
              <GridRow key={item.catalogId} template={template} striped={i % 2 === 1}>
                <Cell className="text-text font-semibold">
                  {item.name}
                  {item.description ? (
                    <span className="text-text-subtle block text-[11px] font-normal">
                      {item.description}
                    </span>
                  ) : null}
                </Cell>
                <Cell align="center">
                  <span className="flex flex-col items-center gap-1">
                    <span className="text-text-muted font-mono text-[11px]">
                      {item.ca ?? "—"}
                    </span>
                    <StatusBadge tone={epiCaStatusTone(item.caStatus)}>
                      {epiCaStatusLabel(item.caStatus)}
                    </StatusBadge>
                    {item.caValidUntil ? (
                      <span className="text-text-subtle text-[11px]">
                        até {formatIsoDateBr(item.caValidUntil)}
                      </span>
                    ) : null}
                  </span>
                </Cell>
                <Cell align="center" className="text-text-muted">
                  {item.manufacturer ?? "—"}
                </Cell>
                <Cell align="center" className="text-text-muted">
                  {item.norm ?? "—"}
                </Cell>
                <Cell align="center" className="text-text-muted">
                  {formatEpiSpecs(item) ?? "—"}
                </Cell>
                <Cell className="text-text-subtle">
                  {item.contexts
                    .map((c) => `${c.gesName} — ${c.riskDescription}`)
                    .join("; ")}
                </Cell>
              </GridRow>
            ))}
          </DataGrid>
        </div>
      )}
    </section>
  );
}

/** Etapa "Documentos e PDF" do editor de PGR — compõe os painéis. */
export function PgrDocumentsTab({
  pgrId,
  pgrLabel,
  linkedDocuments,
  linkedTotal,
  nr18Checklist,
  epiRelation,
}: {
  pgrId: string;
  pgrLabel: string;
  linkedDocuments: DocumentListItem[];
  linkedTotal: number;
  /** `null` quando a unidade do PGR não é Obra/Canteiro — o painel some inteiro. */
  nr18Checklist: Nr18ChecklistSummary | null;
  epiRelation: PgrEpiRelationItem[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <PgrPdfPanel pgrId={pgrId} />
      {nr18Checklist ? (
        <PgrNr18Panel pgrId={pgrId} pgrLabel={pgrLabel} checklist={nr18Checklist} />
      ) : null}
      <PgrEpiRelationPanel items={epiRelation} />
      <PgrLinkedDocumentsPanel
        pgrId={pgrId}
        pgrLabel={pgrLabel}
        linkedDocuments={linkedDocuments}
        linkedTotal={linkedTotal}
      />
    </div>
  );
}
