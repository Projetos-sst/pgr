import { createHash } from "node:crypto";
import PizZip from "pizzip";

import {
  buildExportManifest,
  recordEntry,
  zipExportPackage,
  type ExportEntry,
} from "@/shared/domains/retention/export-manifest";

const sha256 = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
const bytes = (text: string) => Buffer.from(text, "utf8");
const fileEntry = (
  path: string,
  content: string | null,
  expectedSha256: string | null = null,
): ExportEntry => ({
  path,
  category: "pgr_documents",
  source: { table: "documents", id: path },
  bytes: content === null ? null : bytes(content),
  expectedSha256,
});
const header = {
  scope: { type: "pgr" as const, orgId: "org_a", pgrId: "p1", companyId: "c1" },
  exportedBy: "owner",
  exportedAt: "2026-11-13T12:00:00.000Z",
  policy: { status: "not_approved" as const, reason: "no_policy" as const },
};

describe("manifesto da exportação", () => {
  it("traz o SHA-256 e o tamanho de cada item e o hash do conjunto", () => {
    const manifest = buildExportManifest({
      ...header,
      entries: [fileEntry("files/b.docx", "bbb"), fileEntry("files/a.docx", "a")],
    });
    expect(manifest.status).toBe("complete");
    expect(manifest.items).toEqual([
      expect.objectContaining({
        path: "files/a.docx",
        status: "ok",
        sha256: sha256("a"),
        sizeBytes: 1,
      }),
      expect.objectContaining({
        path: "files/b.docx",
        status: "ok",
        sha256: sha256("bbb"),
        sizeBytes: 3,
      }),
    ]);
    expect(manifest.contentSha256).toBe(
      sha256(`files/a.docx\tok\t${sha256("a")}\nfiles/b.docx\tok\t${sha256("bbb")}\n`),
    );
    expect(manifest.scope).toEqual(header.scope);
    expect(manifest.exportedBy).toBe("owner");
    expect(manifest.policy).toEqual(header.policy);
  });

  it("o hash do conjunto não muda com a ordem, com quem exporta nem com a hora", () => {
    const entries = [fileEntry("files/a.docx", "a"), fileEntry("files/b.docx", "b")];
    const first = buildExportManifest({ ...header, entries });
    const second = buildExportManifest({
      ...header,
      exportedBy: "collaborator",
      exportedAt: "2027-01-01T00:00:00.000Z",
      entries: [...entries].reverse(),
    });
    expect(second.contentSha256).toBe(first.contentSha256);
  });

  it("o hash do conjunto muda quando um arquivo muda", () => {
    const before = buildExportManifest({
      ...header,
      entries: [fileEntry("files/a.docx", "a")],
    });
    const after = buildExportManifest({
      ...header,
      entries: [fileEntry("files/a.docx", "A")],
    });
    expect(after.contentSha256).not.toBe(before.contentSha256);
  });

  it("arquivo ausente entra no manifesto como ausente e marca a exportação incompleta", () => {
    const manifest = buildExportManifest({
      ...header,
      entries: [fileEntry("files/a.docx", "a"), fileEntry("files/gone.docx", null)],
    });
    expect(manifest.status).toBe("incomplete");
    expect(manifest.items[1]).toEqual(
      expect.objectContaining({
        path: "files/gone.docx",
        status: "missing",
        sha256: null,
        sizeBytes: null,
      }),
    );
    expect(manifest.counts).toEqual({ total: 2, ok: 1, missing: 1, hashMismatch: 0 });
  });

  it("arquivo com hash diferente do registrado na emissão é apontado", () => {
    const manifest = buildExportManifest({
      ...header,
      entries: [
        fileEntry("files/ok.docx", "a", sha256("a")),
        fileEntry("files/tampered.docx", "changed", sha256("original")),
      ],
    });
    expect(manifest.status).toBe("incomplete");
    expect(manifest.items.map((item) => item.status)).toEqual(["ok", "hash_mismatch"]);
    expect(manifest.items[1].expectedSha256).toBe(sha256("original"));
    expect(manifest.items[1].sha256).toBe(sha256("changed"));
  });

  it("registros viram JSON de chaves ordenadas, na ordem do id", () => {
    const one = recordEntry("pgr_review_records", "pgr_document_approvals", [
      { id: "b", kind: "issued", at: new Date("2026-01-02T00:00:00.000Z") },
      { id: "a", kind: "approved", at: new Date("2026-01-01T00:00:00.000Z") },
    ]);
    const other = recordEntry("pgr_review_records", "pgr_document_approvals", [
      { kind: "approved", at: new Date("2026-01-01T00:00:00.000Z"), id: "a" },
      { at: new Date("2026-01-02T00:00:00.000Z"), id: "b", kind: "issued" },
    ]);
    expect(one.path).toBe("records/pgr_document_approvals.json");
    expect(Buffer.from(one.bytes ?? []).toString("utf8")).toBe(
      '[{"at":"2026-01-01T00:00:00.000Z","id":"a","kind":"approved"},{"at":"2026-01-02T00:00:00.000Z","id":"b","kind":"issued"}]',
    );
    expect(sha256(one.bytes ?? "")).toBe(sha256(other.bytes ?? ""));
  });
});

describe("pacote da exportação", () => {
  it("contém o manifesto e cada item presente; quem recebe confere o hash", () => {
    const entries = [fileEntry("files/a.docx", "a"), fileEntry("files/gone.docx", null)];
    const manifest = buildExportManifest({ ...header, entries });
    const zip = new PizZip(zipExportPackage(manifest, entries));
    expect(Object.keys(zip.files).sort()).toEqual(["files/a.docx", "manifest.json"]);
    const read = JSON.parse(zip.file("manifest.json")?.asText() ?? "{}");
    expect(read.contentSha256).toBe(manifest.contentSha256);
    expect(sha256(zip.file("files/a.docx")?.asUint8Array() ?? "")).toBe(
      read.items[0].sha256,
    );
  });
});
