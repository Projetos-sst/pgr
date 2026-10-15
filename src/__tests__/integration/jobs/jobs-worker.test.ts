/**
 * Integração da fila `jobs` + worker do documento do PGR (#39) contra Postgres efêmero
 * (NUNCA SQLite — `FOR UPDATE SKIP LOCKED` + RLS não existem lá). Storage e o
 * gerador do template (`generatePgrDocx`, coberto em `pdf/pgr-docx.test.ts`)
 * MOCKADOS. Claim/status via handle OWNER; resultado via `withOrg` (app_runtime).
 * Cobre: enqueue (generating+job, formato pdf padrão/docx explícito, cross-tenant),
 * claim concorrente (1 vence), stale reaper, retry/attempts, idempotência do
 * resultado e job legado sem `format`.
 */
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const putGeneratedDocument = jest.fn();
const generatePgrDocx = jest.fn();

jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  generatedDocumentPath: (orgId: string, documentId: string, format: string) =>
    `${orgId}/documentos/generated/${documentId}.${format}`,
  putGeneratedDocument: (...a: unknown[]) => putGeneratedDocument(...a),
}));
jest.mock("@/shared/server/platform/pgr-docx-core", () => ({
  generatePgrDocx: (...a: unknown[]) => generatePgrDocx(...a),
}));

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type postgres from "postgres";

import * as schema from "@/shared/db/schema";
import {
  claimNextJob,
  recoverStaleJobs,
  returnJobToPending,
} from "@/shared/db/repositories/jobs-admin";
import { enqueuePgrPdf } from "@/shared/db/repositories/pdf-batch";
import {
  discardPdfBatchDocument,
  processPdfBatchJob,
} from "@/shared/server/platform/pdf-batch-core";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const d = shouldRun ? describe : describe.skip;

d("jobs queue + pdf-batch worker", () => {
  let ownerSql: ReturnType<typeof postgres>;
  let ownerSql2: ReturnType<typeof postgres>;
  let ownerDb: PostgresJsDatabase<typeof schema>;
  let ownerDb2: PostgresJsDatabase<typeof schema>;

  beforeAll(async () => {
    ownerSql = adminClient();
    ownerSql2 = adminClient();
    ownerDb = drizzle(ownerSql, { schema });
    ownerDb2 = drizzle(ownerSql2, { schema });
    await applyMigrations(ownerSql);
  });

  afterAll(async () => {
    await ownerSql?.end();
    await ownerSql2?.end();
  });

  beforeEach(async () => {
    await seedPgrBase(ownerSql);
    generatePgrDocx
      .mockReset()
      .mockImplementation(async (_o: string, _p: string, opts: { format?: string }) =>
        opts.format === "pdf"
          ? {
              fileName: "pgr-a-ltda-wu-a-2026-10-02.pdf",
              title: "PGR — A Ltda — WU A",
              contentType: "application/pdf",
              file: Buffer.from("%PDF-1.4 fake"),
              missingTags: [],
            }
          : {
              fileName: "pgr-a-ltda-wu-a-2026-10-02.docx",
              title: "PGR — A Ltda — WU A",
              contentType: DOCX_MIME,
              file: Buffer.from("PK fake docx"),
              missingTags: [],
            },
      );
    putGeneratedDocument
      .mockReset()
      .mockImplementation(
        async (orgId: string, documentId: string, _f: Buffer, o: { format: string }) => ({
          storagePath: `${orgId}/documentos/generated/${documentId}.${o.format}`,
          sizeBytes: 99,
        }),
      );
  });

  it("enqueue pré-cria documento em generating + job pendente (PDF por padrão)", async () => {
    // Sem options — exatamente como a Server Action `enqueuePgrPdfBatchAction` chama.
    const res = await enqueuePgrPdf("org_a", PGR_IDS.pgrA);
    expect(res.format).toBe("pdf");

    const [doc] = await ownerSql<
      { status: string; related_entity_id: string; storage_path: string }[]
    >`select status, related_entity_id, storage_path from public.documents where id = ${res.documentId}`;
    expect(doc.status).toBe("generating");
    expect(doc.related_entity_id).toBe(PGR_IDS.pgrA);
    expect(doc.storage_path).toBe(`org_a/documentos/generated/${res.documentId}.pdf`);

    const [job] = await ownerSql<
      {
        status: string;
        job_type: string;
        payload: { documentId: string; kind: string; pgrId: string; format: string };
      }[]
    >`select status, job_type, payload from public.jobs where id = ${res.jobId}`;
    expect(job.status).toBe("pending");
    expect(job.job_type).toBe("pdf_batch");
    expect(job.payload).toEqual({
      documentId: res.documentId,
      kind: "pgr",
      pgrId: PGR_IDS.pgrA,
      format: "pdf",
    });
  });

  it("enqueue com format docx pré-grava path .docx e payload docx", async () => {
    const res = await enqueuePgrPdf("org_a", PGR_IDS.pgrA, { format: "docx" });
    expect(res.format).toBe("docx");

    const [doc] = await ownerSql<
      { storage_path: string }[]
    >`select storage_path from public.documents where id = ${res.documentId}`;
    expect(doc.storage_path).toBe(`org_a/documentos/generated/${res.documentId}.docx`);
    const [job] = await ownerSql<
      { payload: { format: string } }[]
    >`select payload from public.jobs where id = ${res.jobId}`;
    expect(job.payload.format).toBe("docx");
  });

  it("enqueue de PGR de outro escritório → FK_NOT_FOUND", async () => {
    await expect(enqueuePgrPdf("org_a", PGR_IDS.pgrB)).rejects.toBeInstanceOf(
      ReferenceNotFoundError,
    );
  });

  it("claim concorrente: exatamente um processador obtém o job", async () => {
    await enqueuePgrPdf("org_a", PGR_IDS.pgrA);

    const [a, b] = await Promise.all([
      claimNextJob(ownerDb, "pdf_batch"),
      claimNextJob(ownerDb2, "pdf_batch"),
    ]);
    const claimed = [a, b].filter((j) => j !== null);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.status).toBe("processing");
    expect(claimed[0]!.attempts).toBe(1);
  });

  it("retry devolve o job à fila e incrementa attempts", async () => {
    await enqueuePgrPdf("org_a", PGR_IDS.pgrA);

    const first = await claimNextJob(ownerDb, "pdf_batch");
    expect(first!.attempts).toBe(1);
    await returnJobToPending(ownerDb, first!.id);

    const second = await claimNextJob(ownerDb, "pdf_batch");
    expect(second!.id).toBe(first!.id);
    expect(second!.attempts).toBe(2);
  });

  it("stale reaper devolve claim travado a pending", async () => {
    const { jobId } = await enqueuePgrPdf("org_a", PGR_IDS.pgrA);
    await ownerSql`update public.jobs set status='processing', locked_at = now() - interval '10 minutes' where id = ${jobId}`;

    const recovered = await recoverStaleJobs(ownerDb, 300);
    expect(recovered).toBeGreaterThanOrEqual(1);

    const [job] = await ownerSql<
      { status: string; locked_at: string | null }[]
    >`select status, locked_at from public.jobs where id = ${jobId}`;
    expect(job.status).toBe("pending");
    expect(job.locked_at).toBeNull();
  });

  it("processamento é idempotente: reprocessar não duplica o documento", async () => {
    const { documentId } = await enqueuePgrPdf("org_a", PGR_IDS.pgrA);

    const job = await claimNextJob(ownerDb, "pdf_batch");
    await processPdfBatchJob(job!);
    await processPdfBatchJob(job!); // reprocessa (at-least-once)

    // O template é preenchido com o PGR do tenant DO JOB (nunca de input do cliente).
    expect(generatePgrDocx).toHaveBeenCalledWith("org_a", PGR_IDS.pgrA, {
      format: "pdf",
    });
    expect(putGeneratedDocument).toHaveBeenCalledWith(
      "org_a",
      documentId,
      expect.any(Buffer),
      { format: "pdf", contentType: "application/pdf" },
    );

    const rows = await ownerSql<
      { status: string; size_bytes: number; storage_path: string; name: string }[]
    >`select status, size_bytes::int as size_bytes, storage_path, name from public.documents where id = ${documentId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("ready");
    expect(rows[0].size_bytes).toBe(99);
    expect(rows[0].storage_path).toBe(`org_a/documentos/generated/${documentId}.pdf`);
    expect(rows[0].name).toBe("PGR — A Ltda — WU A");

    const [{ c }] = await ownerSql<{ c: number }[]>`
      select count(*)::int as c from public.documents where org_id = 'org_a'`;
    expect(c).toBe(1);
  });

  it("job legado (payload sem format) continua processável e gera PDF pelo template", async () => {
    const { documentId, jobId } = await enqueuePgrPdf("org_a", PGR_IDS.pgrA, {
      format: "pdf",
    });
    // Simula um job enfileirado antes da fatia 030: payload sem `format`.
    await ownerSql`update public.jobs set payload = payload - 'format' where id = ${jobId}`;

    const job = await claimNextJob(ownerDb, "pdf_batch");
    expect(job!.payload).not.toHaveProperty("format");
    const result = await processPdfBatchJob(job!);

    expect(result.format).toBe("pdf");
    expect(generatePgrDocx).toHaveBeenCalledWith("org_a", PGR_IDS.pgrA, {
      format: "pdf",
    });
    const [doc] = await ownerSql<
      { status: string; storage_path: string }[]
    >`select status, storage_path from public.documents where id = ${documentId}`;
    expect(doc.status).toBe("ready");
    expect(doc.storage_path).toBe(`org_a/documentos/generated/${documentId}.pdf`);
  });

  it("falha final descarta a versão em generating e a pronta volta a ser a vigente", async () => {
    const first = await enqueuePgrPdf("org_a", PGR_IDS.pgrA);
    const firstJob = await claimNextJob(ownerDb, "pdf_batch");
    await processPdfBatchJob(firstJob!);

    const second = await enqueuePgrPdf("org_a", PGR_IDS.pgrA);
    const secondJob = await claimNextJob(ownerDb, "pdf_batch");
    expect(secondJob!.id).toBe(second.jobId);
    await discardPdfBatchDocument(secondJob!);

    const rows = await ownerSql<
      { id: string; status: string; version: number }[]
    >`select id, status, version from public.documents where related_entity_id = ${PGR_IDS.pgrA}`;
    expect(rows).toEqual([{ id: first.documentId, status: "ready", version: 1 }]);
  });
});
