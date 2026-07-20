/**
 * Unit da orquestração de processamento de job `pdf_batch` (#39) com deps
 * mockadas — sem DB/Gotenberg/Storage reais. Foca no fluxo e na idempotência do
 * path determinístico.
 */
import type { PgrConsolidated } from "@/shared/domains/pgr/pgr-consolidated";
import type { Job } from "@/shared/db/schema/jobs";

const getPgrConsolidated = jest.fn();
const htmlToPdf = jest.fn();
const putGeneratedPdf = jest.fn();
const capturedUpdates: Record<string, unknown>[] = [];

jest.mock("@/shared/db/repositories/pgr-consolidated", () => ({
  getPgrConsolidated: (...a: unknown[]) => getPgrConsolidated(...a),
}));
jest.mock("@/shared/integrations/pdf/gotenberg", () => ({
  htmlToPdf: (...a: unknown[]) => htmlToPdf(...a),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  putGeneratedPdf: (...a: unknown[]) => putGeneratedPdf(...a),
  generatedPdfPath: (orgId: string, documentId: string) =>
    `${orgId}/documentos/generated/${documentId}.pdf`,
}));
jest.mock("@/shared/db/with-org", () => ({
  withOrg: async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      update: () => ({
        set: (values: Record<string, unknown>) => {
          capturedUpdates.push(values);
          return { where: async () => undefined };
        },
      }),
    }),
}));

import { processPdfBatchJob } from "@/shared/server/platform/pdf-batch-core";

const DOC_ID = "11111111-1111-1111-1111-1111111111a0";
const PGR_ID = "11111111-1111-1111-1111-1111111111d4";

function makeJob(): Job {
  return {
    id: "job-1",
    orgId: "org_a",
    jobType: "pdf_batch",
    status: "processing",
    payload: { documentId: DOC_ID, kind: "pgr", pgrId: PGR_ID },
    result: null,
    attempts: 1,
    lockedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Job;
}

const consolidated: PgrConsolidated = {
  pgr: {
    id: PGR_ID,
    companyName: "ACME Ltda",
    workUnitName: null,
    responsible: null,
    registrationType: "not_applicable",
    registrationNumber: null,
    issuedAt: null,
    validUntil: null,
  },
  ges: [],
};

beforeEach(() => {
  getPgrConsolidated.mockReset().mockResolvedValue(consolidated);
  htmlToPdf.mockReset().mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  putGeneratedPdf.mockReset().mockResolvedValue({
    storagePath: `org_a/documentos/generated/${DOC_ID}.pdf`,
    sizeBytes: 12,
  });
  capturedUpdates.length = 0;
});

describe("processPdfBatchJob", () => {
  it("gera, faz upload determinístico e marca o documento ready", async () => {
    const result = await processPdfBatchJob(makeJob());

    expect(getPgrConsolidated).toHaveBeenCalledWith("org_a", PGR_ID);
    expect(htmlToPdf).toHaveBeenCalledTimes(1);
    expect(putGeneratedPdf).toHaveBeenCalledWith("org_a", DOC_ID, expect.any(Buffer));
    expect(capturedUpdates[0]).toMatchObject({
      status: "ready",
      sizeBytes: 12,
      name: "PGR — ACME Ltda",
    });
    expect(result).toEqual({ documentId: DOC_ID, sizeBytes: 12 });
  });

  it("é idempotente no path (reprocessar usa o mesmo documentId)", async () => {
    await processPdfBatchJob(makeJob());
    await processPdfBatchJob(makeJob());
    const paths = putGeneratedPdf.mock.calls.map((c) => c[1]);
    expect(paths).toEqual([DOC_ID, DOC_ID]);
  });

  it("lança quando o PGR não existe para o tenant", async () => {
    getPgrConsolidated.mockResolvedValue(null);
    await expect(processPdfBatchJob(makeJob())).rejects.toThrow();
  });
});
