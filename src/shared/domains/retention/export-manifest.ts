import { createHash } from "node:crypto";
import PizZip from "pizzip";

import { stableStringify } from "@/shared/domains/medicine/pcmso-composition";

import type { RetentionCategory, RetentionPolicyState } from "./policy";

export const EXPORT_FORMAT_VERSION = 1;
export const EXPORT_MANIFEST_PATH = "manifest.json";

export type ExportScope = {
  type: "pgr";
  orgId: string;
  pgrId: string;
  companyId: string;
};

export type ExportEntry = {
  path: string;
  category: RetentionCategory;
  source: { table: string; id: string };
  bytes: Uint8Array | null;
  expectedSha256: string | null;
};

export type ExportItemStatus = "ok" | "missing" | "hash_mismatch";

export type ExportManifestItem = {
  path: string;
  category: RetentionCategory;
  source: { table: string; id: string };
  status: ExportItemStatus;
  sha256: string | null;
  expectedSha256: string | null;
  sizeBytes: number | null;
};

export type ExportManifest = {
  formatVersion: number;
  scope: ExportScope;
  exportedBy: string;
  exportedAt: string;
  policy: RetentionPolicyState;
  status: "complete" | "incomplete";
  counts: { total: number; ok: number; missing: number; hashMismatch: number };
  contentSha256: string;
  items: ExportManifestItem[];
};

export type RetentionExportStatus = ExportManifest["status"] | "failed";

const sha256 = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");

const byCodePoint = (a: string, b: string) => (a < b ? -1 : Number(a > b));

function itemStatus(digest: string, expected: string | null): ExportItemStatus {
  return expected && expected !== digest ? "hash_mismatch" : "ok";
}

function manifestItem(entry: ExportEntry): ExportManifestItem {
  const { path, category, source, bytes, expectedSha256 } = entry;
  const head = { path, category, source, expectedSha256 };
  if (!bytes) return { ...head, status: "missing", sha256: null, sizeBytes: null };
  const digest = sha256(bytes);
  return {
    ...head,
    status: itemStatus(digest, expectedSha256),
    sha256: digest,
    sizeBytes: bytes.byteLength,
  };
}

function count(items: ExportManifestItem[], status: ExportItemStatus): number {
  return items.filter((item) => item.status === status).length;
}

export function buildExportManifest(input: {
  scope: ExportScope;
  exportedBy: string;
  exportedAt: string;
  policy: RetentionPolicyState;
  entries: readonly ExportEntry[];
}): ExportManifest {
  const items = input.entries
    .map(manifestItem)
    .sort((a, b) => byCodePoint(a.path, b.path));
  const counts = {
    total: items.length,
    ok: count(items, "ok"),
    missing: count(items, "missing"),
    hashMismatch: count(items, "hash_mismatch"),
  };
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    scope: input.scope,
    exportedBy: input.exportedBy,
    exportedAt: input.exportedAt,
    policy: input.policy,
    status: counts.ok === counts.total ? "complete" : "incomplete",
    counts,
    contentSha256: sha256(
      items
        .map((item) => `${item.path}\t${item.status}\t${item.sha256 ?? "-"}\n`)
        .join(""),
    ),
    items,
  };
}

export function recordEntry(
  category: RetentionCategory,
  table: string,
  rows: readonly ({ id: string } & Record<string, unknown>)[],
): ExportEntry {
  const ordered: unknown = JSON.parse(
    JSON.stringify([...rows].sort((a, b) => byCodePoint(a.id, b.id))),
  );
  return {
    path: `records/${table}.json`,
    category,
    source: { table, id: "*" },
    bytes: Buffer.from(stableStringify(ordered), "utf8"),
    expectedSha256: null,
  };
}

export function zipExportPackage(
  manifest: ExportManifest,
  entries: readonly ExportEntry[],
): Buffer {
  const date = new Date(manifest.exportedAt);
  const zip = new PizZip();
  zip.file(EXPORT_MANIFEST_PATH, JSON.stringify(manifest, null, 2), { date });
  for (const { path, bytes } of entries) {
    if (bytes) zip.file(path, bytes, { date });
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
