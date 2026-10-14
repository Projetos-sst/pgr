/**
 * Unit da orquestração de processamento de job `pdf_batch` (#39) com deps
 * mockadas — sem DB/template/Gotenberg/Storage reais. O documento do PGR sai do
 * template DOCX (`generatePgrDocx`, fatia 030): o job repassa `job.orgId` + `pgrId`
 * + `format` do payload, grava no path do formato e marca a linha `ready`.
 */
import type { Job } from "@/shared/db/schema/jobs";
import { NotFoundError } from "@/shared/errors/not-found-error";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const generatePgrDocx = jest.fn();
const putGeneratedDocument = jest.fn();
const capturedUpdates: Record<string, unknown>[] = [];
const withOrgCalls: string[] = [];

jest.mock("@/shared/server/platform/pgr-docx-core", () => ({
  generatePgrDocx: (...a: unknown[]) => generatePgrDocx(...a),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  putGeneratedDocument: (...a: unknown[]) => putGeneratedDocument(...a),
}));
jest.mock("@/shared/db/with-org", () => ({
  withOrg: async (orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
    withOrgCalls.push(orgId);
    return fn({
      update: () => ({
        set: (values: Record<string, unknown>) => {
          capturedUpdates.push(values);
          return { where: async () => undefined };
        },
      }),
    });
  },
}));

import { processPdfBatchJob } from "@/shared/server/platform/pdf-batch-core";

const DOC_ID = "11111111-1111-1111-1111-1111111111a0";
const PGR_ID = "11111111-1111-1111-1111-1111111111d4";
const FILE = Buffer.from("PK fake docx");

function makeJob(payload: Record<string, unknown> = {}): Job {
  return {
    id: "job-1",
    orgId: "org_a",
    jobType: "pdf_batch",
    status: "processing",
    payload: { documentId: DOC_ID, kind: "pgr", pgrId: PGR_ID, ...payload },
    result: null,
    attempts: 1,
    lockedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Job;
}

beforeEach(() => {
  generatePgrDocx
    .mockReset()
    .mockImplementation(
      async (_orgId: string, _pgrId: string, options: { format?: string }) =>
        options.format === "pdf"
          ? {
              fileName: "pgr-acme-2026-10-02.pdf",
              title: "PGR — Acme",
              contentType: "application/pdf",
              file: Buffer.from("%PDF-1.4 fake"),
              missingTags: [],
            }
          : {
              fileName: "pgr-acme-2026-10-02.docx",
              title: "PGR — Acme",
              contentType: DOCX_MIME,
              file: FILE,
              missingTags: [],
            },
    );
  putGeneratedDocument
    .mockReset()
    .mockImplementation(
      async (orgId: string, documentId: string, file: Buffer, o: { format: string }) => ({
        storagePath: `${orgId}/documentos/generated/${documentId}.${o.format}`,
        sizeBytes: file.byteLength,
      }),
    );
  capturedUpdates.length = 0;
  withOrgCalls.length = 0;
});

describe("processPdfBatchJob (documento do PGR pelo template DOCX)", () => {
  it("format docx: preenche o template do PGR do tenant do job e guarda o DOCX", async () => {
    const result = await processPdfBatchJob(makeJob({ format: "docx" }));

    expect(generatePgrDocx).toHaveBeenCalledWith("org_a", PGR_ID, { format: "docx" });
    expect(putGeneratedDocument).toHaveBeenCalledWith("org_a", DOC_ID, FILE, {
      format: "docx",
      contentType: DOCX_MIME,
    });
    expect(withOrgCalls).toEqual(["org_a"]);
    expect(capturedUpdates).toEqual([
      {
        status: "ready",
        sizeBytes: FILE.byteLength,
        storagePath: `org_a/documentos/generated/${DOC_ID}.docx`,
        name: "PGR — Acme",
      },
    ]);
    expect(result).toEqual({
      documentId: DOC_ID,
      sizeBytes: FILE.byteLength,
      format: "docx",
    });
  });

  it("payload legado sem format → PDF a partir do template, no path .pdf", async () => {
    const result = await processPdfBatchJob(makeJob());

    expect(generatePgrDocx).toHaveBeenCalledWith("org_a", PGR_ID, { format: "pdf" });
    expect(putGeneratedDocument).toHaveBeenCalledWith(
      "org_a",
      DOC_ID,
      expect.any(Buffer),
      {
        format: "pdf",
        contentType: "application/pdf",
      },
    );
    expect(capturedUpdates[0]).toMatchObject({
      status: "ready",
      storagePath: `org_a/documentos/generated/${DOC_ID}.pdf`,
      name: "PGR — Acme",
    });
    expect(result.format).toBe("pdf");
  });

  it("é idempotente no path (reprocessar usa o mesmo documentId e formato)", async () => {
    await processPdfBatchJob(makeJob({ format: "docx" }));
    await processPdfBatchJob(makeJob({ format: "docx" }));
    const targets = putGeneratedDocument.mock.calls.map((c) => [c[1], c[3].format]);
    expect(targets).toEqual([
      [DOC_ID, "docx"],
      [DOC_ID, "docx"],
    ]);
  });

  it("PGR inexistente/cross-tenant: propaga NotFoundError sem upload nem update", async () => {
    generatePgrDocx.mockRejectedValue(new NotFoundError());

    await expect(processPdfBatchJob(makeJob({ format: "docx" }))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(putGeneratedDocument).not.toHaveBeenCalled();
    expect(capturedUpdates).toEqual([]);
  });

  it("payload inválido (format desconhecido) falha antes de gerar", async () => {
    await expect(processPdfBatchJob(makeJob({ format: "odt" }))).rejects.toThrow();
    expect(generatePgrDocx).not.toHaveBeenCalled();
  });
});
