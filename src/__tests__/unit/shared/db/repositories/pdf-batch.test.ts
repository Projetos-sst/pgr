/** @jest-environment node */

jest.mock("@/shared/db/with-org", () => ({ withOrg: jest.fn() }));
jest.mock("@/shared/db/repositories/audited-write", () => ({
  auditedTenantWrite: jest.fn(
    (_orgId: string, _operation: string, write: () => Promise<unknown>) => write(),
  ),
}));
jest.mock("@/shared/db/repositories/document-versions", () => ({
  getCurrentVersionTx: jest.fn(),
}));
jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  generatedDocumentPath: (orgId: string, documentId: string, format: string) =>
    `${orgId}/documentos/generated/${documentId}.${format}`,
}));

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { enqueuePgrPdf } from "@/shared/db/repositories/pdf-batch";
import { getCurrentVersionTx } from "@/shared/db/repositories/document-versions";
import { documents } from "@/shared/db/schema/documents";
import { jobs } from "@/shared/db/schema/jobs";
import { withOrg } from "@/shared/db/with-org";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

type Row = Record<string, unknown>;

const ORG = "org_a";
const PGR_ID = "11111111-1111-1111-1111-1111111111d4";
const GROUP_ID = "22222222-2222-2222-2222-222222222222";
const JOB_ID = "33333333-3333-3333-3333-333333333333";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fakeTx(selectResults: Row[][]) {
  const results = [...selectResults];
  const wheres: unknown[] = [];
  const locks: unknown[] = [];
  const inserts: { table: unknown; values: Row }[] = [];
  const tx = {
    select: jest.fn(() => {
      const result = results.shift() ?? [];
      const lock = jest.fn(async (strength: unknown) => {
        locks.push(strength);
        return result;
      });
      const limit = jest.fn(() => Object.assign(Promise.resolve(result), { for: lock }));
      const orderBy = jest.fn(() => ({ limit }));
      const where = jest.fn((condition: unknown) => {
        wheres.push(condition);
        return { limit, orderBy };
      });
      return { from: jest.fn(() => ({ where })) };
    }),
    insert: jest.fn((table: unknown) => ({
      values: (values: Row) => {
        inserts.push({ table, values });
        return Object.assign(Promise.resolve(), {
          returning: async () => [{ id: JOB_ID }],
        });
      },
    })),
  };
  return { tx, wheres, locks, inserts };
}

function runWith(tx: unknown) {
  (withOrg as jest.Mock).mockImplementation(
    async (_orgId: string, fn: (t: unknown) => Promise<unknown>) => fn(tx),
  );
}

function toQuery(condition: unknown) {
  return new PgDialect().sqlToQuery(condition as SQL);
}

beforeEach(() => {
  jest.clearAllMocks();
  (getCurrentVersionTx as jest.Mock).mockReset();
});

describe("enqueuePgrPdf (nova versão na família do GED)", () => {
  it("primeira geração do PGR cria a família no GED na versão 1", async () => {
    const { tx, inserts } = fakeTx([[{ id: PGR_ID }], []]);
    runWith(tx);

    const result = await enqueuePgrPdf(ORG, PGR_ID);

    expect(getCurrentVersionTx).not.toHaveBeenCalled();
    const [docInsert] = inserts;
    expect(docInsert.table).toBe(documents);
    expect(docInsert.values).toMatchObject({
      id: result.documentId,
      orgId: ORG,
      docType: "PGR",
      version: 1,
      status: "generating",
      relatedEntityType: "pgr",
      relatedEntityId: PGR_ID,
      folderId: null,
      name: "Documento PGR",
      validUntil: null,
    });
    expect(docInsert.values.documentGroupId).toMatch(UUID_RE);
  });

  it("nova geração do mesmo PGR reutiliza o documentGroupId e cria a v2", async () => {
    (getCurrentVersionTx as jest.Mock).mockResolvedValue({
      documentGroupId: GROUP_ID,
      version: 1,
    });
    const { tx, inserts } = fakeTx([[{ id: PGR_ID }], [{ documentGroupId: GROUP_ID }]]);
    runWith(tx);

    await enqueuePgrPdf(ORG, PGR_ID);

    expect(getCurrentVersionTx).toHaveBeenCalledWith(tx, ORG, GROUP_ID);
    expect(inserts[0].values).toMatchObject({ documentGroupId: GROUP_ID, version: 2 });
  });

  it("a versão seguinte soma sobre a vigente (v3 quando a vigente é v2)", async () => {
    (getCurrentVersionTx as jest.Mock).mockResolvedValue({
      documentGroupId: GROUP_ID,
      version: 2,
    });
    const { tx, inserts } = fakeTx([[{ id: PGR_ID }], [{ documentGroupId: GROUP_ID }]]);
    runWith(tx);

    await enqueuePgrPdf(ORG, PGR_ID);

    expect(inserts[0].values).toMatchObject({ documentGroupId: GROUP_ID, version: 3 });
  });

  it("nova versão herda pasta, nome e validade da vigente", async () => {
    (getCurrentVersionTx as jest.Mock).mockResolvedValue({
      documentGroupId: GROUP_ID,
      version: 1,
      folderId: "44444444-4444-4444-4444-444444444444",
      name: "PGR Obra Central",
      validUntil: "2027-10-01",
    });
    const { tx, inserts } = fakeTx([[{ id: PGR_ID }], [{ documentGroupId: GROUP_ID }]]);
    runWith(tx);

    await enqueuePgrPdf(ORG, PGR_ID);

    expect(inserts[0].values).toMatchObject({
      documentGroupId: GROUP_ID,
      version: 2,
      folderId: "44444444-4444-4444-4444-444444444444",
      name: "PGR Obra Central",
      validUntil: "2027-10-01",
    });
  });

  it("busca a família só do tenant, do PGR e do docType PGR", async () => {
    const { tx, wheres } = fakeTx([[{ id: PGR_ID }], []]);
    runWith(tx);

    await enqueuePgrPdf(ORG, PGR_ID);

    expect(toQuery(wheres[1]).params).toEqual([ORG, "pgr", PGR_ID, "PGR"]);
  });

  it("trava a linha do PGR com FOR UPDATE para serializar gerações concorrentes", async () => {
    const { tx, locks } = fakeTx([[{ id: PGR_ID }], []]);
    runWith(tx);

    await enqueuePgrPdf(ORG, PGR_ID);

    expect(locks).toEqual(["update"]);
  });

  it("PGR inexistente ou de outro tenant → FK_NOT_FOUND sem gravar nada", async () => {
    const { tx, inserts } = fakeTx([[]]);
    runWith(tx);

    await expect(enqueuePgrPdf(ORG, PGR_ID)).rejects.toBeInstanceOf(
      ReferenceNotFoundError,
    );
    expect(inserts).toHaveLength(0);
    expect(getCurrentVersionTx).not.toHaveBeenCalled();
  });

  it("enfileira o job pdf_batch com o documentId e o formato pedidos", async () => {
    const { tx, inserts } = fakeTx([[{ id: PGR_ID }], []]);
    runWith(tx);

    const result = await enqueuePgrPdf(ORG, PGR_ID, { format: "docx" });

    const [docInsert, jobInsert] = inserts;
    expect(docInsert.values.storagePath).toBe(
      `${ORG}/documentos/generated/${result.documentId}.docx`,
    );
    expect(jobInsert.table).toBe(jobs);
    expect(jobInsert.values).toEqual({
      orgId: ORG,
      jobType: "pdf_batch",
      status: "pending",
      payload: {
        documentId: result.documentId,
        kind: "pgr",
        pgrId: PGR_ID,
        format: "docx",
      },
    });
    expect(result).toEqual({
      documentId: docInsert.values.id,
      jobId: JOB_ID,
      pgrId: PGR_ID,
      format: "docx",
    });
  });
});
