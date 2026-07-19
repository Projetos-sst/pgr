/**
 * Integração da fila `jobs` + worker de PDF em lote (#39) contra Postgres efêmero
 * (NUNCA SQLite — `FOR UPDATE SKIP LOCKED` + RLS não existem lá). Storage/Gotenberg/
 * leitura consolidada MOCKADOS. Claim/status via handle OWNER; resultado via
 * `withOrg` (app_runtime). Cobre: enqueue (generating+job, cross-tenant), claim
 * concorrente (1 vence), stale reaper, retry/attempts e idempotência do resultado.
 */
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const putGeneratedPdf = jest.fn();
const htmlToPdf = jest.fn();
const getPgrConsolidated = jest.fn();

jest.mock("@/shared/integrations/storage/documents-storage", () => ({
  generatedPdfPath: (orgId: string, documentId: string) =>
    `${orgId}/documentos/generated/${documentId}.pdf`,
  putGeneratedPdf: (...a: unknown[]) => putGeneratedPdf(...a),
}));
jest.mock("@/shared/integrations/pdf/gotenberg", () => ({
  htmlToPdf: (...a: unknown[]) => htmlToPdf(...a),
}));
jest.mock("@/shared/db/repositories/pgr-consolidated", () => ({
  getPgrConsolidated: (...a: unknown[]) => getPgrConsolidated(...a),
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
import { processPdfBatchJob } from "@/shared/server/platform/pdf-batch-core";
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
    getPgrConsolidated.mockReset();
    htmlToPdf.mockReset().mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
    putGeneratedPdf.mockReset();
  });

  it("enqueue pré-cria documento em generating + job pendente", async () => {
    const res = await enqueuePgrPdf("org_a", PGR_IDS.pgrA);

    const [doc] = await ownerSql<
      { status: string; related_entity_id: string; storage_path: string }[]
    >`select status, related_entity_id, storage_path from public.documents where id = ${res.documentId}`;
    expect(doc.status).toBe("generating");
    expect(doc.related_entity_id).toBe(PGR_IDS.pgrA);
    expect(doc.storage_path).toBe(`org_a/documentos/generated/${res.documentId}.pdf`);

    const [job] = await ownerSql<
      { status: string; job_type: string; payload: { documentId: string } }[]
    >`select status, job_type, payload from public.jobs where id = ${res.jobId}`;
    expect(job.status).toBe("pending");
    expect(job.job_type).toBe("pdf_batch");
    expect(job.payload.documentId).toBe(res.documentId);
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
    getPgrConsolidated.mockResolvedValue({
      pgr: {
        id: PGR_IDS.pgrA,
        companyName: "A Ltda",
        workUnitName: null,
        responsible: null,
        registrationType: "not_applicable",
        registrationNumber: null,
        issuedAt: null,
        validUntil: null,
      },
      ges: [],
    });
    putGeneratedPdf.mockResolvedValue({
      storagePath: `org_a/documentos/generated/${documentId}.pdf`,
      sizeBytes: 99,
    });

    const job = await claimNextJob(ownerDb, "pdf_batch");
    await processPdfBatchJob(job!);
    await processPdfBatchJob(job!); // reprocessa (at-least-once)

    const rows = await ownerSql<
      { status: string; size_bytes: number }[]
    >`select status, size_bytes::int as size_bytes from public.documents where id = ${documentId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("ready");
    expect(rows[0].size_bytes).toBe(99);

    const [{ c }] = await ownerSql<{ c: number }[]>`
      select count(*)::int as c from public.documents where org_id = 'org_a'`;
    expect(c).toBe(1);
  });
});
