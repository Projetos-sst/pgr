/**
 * Lifecycle da fila `jobs` (fatia #39) — handle Drizzle **INJETADO** (conexão
 * owner/unpooled do worker ou o client admin do harness de integração). NÃO
 * importa `server-only` nem o singleton `db`: o claim é **cross-tenant** (a fila
 * é global) e roda FORA do `app_runtime` (contrato 023 §2; precedente
 * `caepi-upsert`). A escrita do **resultado** do job é da `pdf-batch-core` via
 * `withOrg(job.org_id)` — nunca aqui.
 */
import { and, asc, eq, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { jobs, type Job } from "../schema/jobs";

export type QueueDb = PostgresJsDatabase<Record<string, unknown>>;
type JobType = (typeof jobs.jobType.enumValues)[number];

/**
 * Claim atômico — exatamente um processador obtém um job pendente
 * (`FOR UPDATE SKIP LOCKED`). `pending → processing`, `locked_at=now()`,
 * `attempts+=1`. Retorna `null` quando não há job disponível.
 */
export async function claimNextJob(db: QueueDb, jobType?: JobType): Promise<Job | null> {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        jobType
          ? and(eq(jobs.status, "pending"), eq(jobs.jobType, jobType))
          : eq(jobs.status, "pending"),
      )
      .orderBy(asc(jobs.createdAt))
      .for("update", { skipLocked: true })
      .limit(1);
    if (!candidate) return null;

    const [row] = await tx
      .update(jobs)
      .set({
        status: "processing",
        lockedAt: sql`now()`,
        attempts: sql`${jobs.attempts} + 1`,
      })
      .where(eq(jobs.id, candidate.id))
      .returning();
    return row ?? null;
  });
}

/** Recupera claims travados (worker morto): `processing` antigo → `pending`. */
export async function recoverStaleJobs(
  db: QueueDb,
  staleAfterSeconds: number,
): Promise<number> {
  const rows = await db
    .update(jobs)
    .set({ status: "pending", lockedAt: null })
    .where(
      and(
        eq(jobs.status, "processing"),
        lt(jobs.lockedAt, sql`now() - make_interval(secs => ${staleAfterSeconds})`),
      ),
    )
    .returning({ id: jobs.id });
  return rows.length;
}

export async function markJobDone(
  db: QueueDb,
  jobId: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "done", result, lockedAt: null })
    .where(eq(jobs.id, jobId));
}

export async function markJobFailed(
  db: QueueDb,
  jobId: string,
  error: Record<string, unknown>,
): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "failed", result: error, lockedAt: null })
    .where(eq(jobs.id, jobId));
}

/** Devolve um job à fila para nova tentativa (retry sem delay — MVP). */
export async function returnJobToPending(db: QueueDb, jobId: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "pending", lockedAt: null })
    .where(eq(jobs.id, jobId));
}
