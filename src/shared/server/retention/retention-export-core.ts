import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/retention-exports";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  buildExportManifest,
  recordEntry,
  zipExportPackage,
  type ExportEntry,
} from "@/shared/domains/retention/export-manifest";
import { retentionPolicyState } from "@/shared/domains/retention/policy";
import { ExportUnavailableError } from "@/shared/errors/export-unavailable-error";
import { downloadDocumentObject } from "@/shared/integrations/storage/documents-storage";
import type { PageParams } from "@/shared/pagination";

type ExportFile = repo.PgrExportRecords["files"][number];

const pgrKey = (value: string) => requiredUuid("PGR inválido.").parse(value);

function extensionOf(storagePath: string): string {
  const name = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

function expectedHashes(records: repo.PgrExportRecords): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const sample of records.samples) hashes.set(sample.documentId, sample.fileSha256);
  for (const event of records.approvals) {
    if (event.documentId && event.fileSha256)
      hashes.set(event.documentId, event.fileSha256);
  }
  return hashes;
}

function recordEntries(records: repo.PgrExportRecords): ExportEntry[] {
  return [
    recordEntry("pgr_documents", "pgr", [records.head]),
    recordEntry("pgr_documents", "pgr_revisions", records.revisions),
    recordEntry("pgr_documents", "documents", records.files),
    recordEntry("pgr_review_records", "pgr_review_samples", records.samples),
    recordEntry("pgr_review_records", "pgr_review_decisions", records.decisions),
    recordEntry("pgr_review_records", "pgr_document_approvals", records.approvals),
    recordEntry("pgr_review_records", "pgr_docx_text_versions", records.textVersions),
    recordEntry("signature_evidence", "signature_requests", records.requests),
    recordEntry("signature_evidence", "signature_captures", records.captures),
  ];
}

async function fileEntry(
  file: ExportFile,
  expectedSha256: string | null,
): Promise<ExportEntry | null> {
  const downloaded = await downloadDocumentObject(file.storagePath);
  if (downloaded.status === "unavailable") return null;
  return {
    path: `files/${file.documentGroupId}/v${file.version}-${file.id}${extensionOf(file.storagePath)}`,
    category: "pgr_documents",
    source: { table: "documents", id: file.id },
    bytes: downloaded.status === "found" ? downloaded.bytes : null,
    expectedSha256,
  };
}

async function fileEntries(
  records: repo.PgrExportRecords,
): Promise<ExportEntry[] | null> {
  const hashes = expectedHashes(records);
  const entries: ExportEntry[] = [];
  for (const file of records.files.filter((row) => row.status === "ready")) {
    const entry = await fileEntry(file, hashes.get(file.id) ?? null);
    if (!entry) return null;
    entries.push(entry);
  }
  return entries;
}

async function failUnavailable(
  ctx: TenantContext,
  pgrId: string,
  itemCount: number,
): Promise<never> {
  await repo.recordRetentionExport(ctx, pgrId, {
    status: "failed",
    contentSha256: null,
    itemCount,
    missingCount: 0,
    hashMismatchCount: 0,
    failureReason: "storage_unavailable",
  });
  throw new ExportUnavailableError();
}

export async function exportPgrRetentionPackage(ctx: TenantContext, pgrId: string) {
  const key = pgrKey(pgrId);
  const records = await repo.loadPgrExportRecords(ctx, key);
  const recordItems = recordEntries(records);
  const files = await fileEntries(records);
  if (!files) return failUnavailable(ctx, key, recordItems.length + records.files.length);
  const entries = [...recordItems, ...files];
  const manifest = buildExportManifest({
    scope: {
      type: "pgr",
      orgId: ctx.tenantId,
      pgrId: key,
      companyId: records.head.companyId,
    },
    exportedBy: ctx.userId,
    exportedAt: new Date().toISOString(),
    policy: retentionPolicyState(records.policy),
    entries,
  });
  const exportId = await repo.recordRetentionExport(ctx, key, {
    status: manifest.status,
    contentSha256: manifest.contentSha256,
    itemCount: manifest.counts.total,
    missingCount: manifest.counts.missing,
    hashMismatchCount: manifest.counts.hashMismatch,
    failureReason: null,
  });
  return {
    exportId,
    fileName: `pgr-${key}-guarda.zip`,
    file: zipExportPackage(manifest, entries),
    manifest,
  };
}

export function listPgrRetentionExports(
  ctx: TenantContext,
  pgrId: string,
  page: PageParams = {},
) {
  return repo.listRetentionExports(ctx, pgrKey(pgrId), page);
}
