/**
 * Worker de geração de PDF em lote (#39) — processo Node standalone long-lived.
 * Roda com `node --conditions=react-server --import tsx worker/index.ts` (ver
 * script `worker` no package.json e `Dockerfile.worker`). Loop sequencial:
 * recupera claims travados → reivindica 1 job (`FOR UPDATE SKIP LOCKED`) →
 * processa → marca `done`/retry/`failed`. Claim/status na conexão OWNER; o
 * resultado é escrito com `withOrg(job.org_id)` dentro de `processPdfBatchJob`.
 */
import {
  claimNextJob,
  markJobDone,
  markJobFailed,
  recoverStaleJobs,
  returnJobToPending,
} from "@/shared/db/repositories/jobs-admin";
import {
  discardPdfBatchDocument,
  processPdfBatchJob,
} from "@/shared/server/platform/pdf-batch-core";

import { createOwnerDb } from "./owner-db";

const POLL_IDLE_MS = Number(process.env.WORKER_POLL_IDLE_MS ?? 2000);
const STALE_AFTER_SECONDS = Number(process.env.WORKER_STALE_AFTER_SECONDS ?? 300);
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS ?? 3);

let shuttingDown = false;

function log(msg: string, extra: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level: "info", worker: "pdf_batch", msg, ...extra }));
}
function logError(msg: string, error: unknown): void {
  console.error(
    JSON.stringify({
      level: "error",
      worker: "pdf_batch",
      msg,
      error: errorMessage(error),
    }),
  );
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { db, close } = createOwnerDb();
  log("started", { pollIdleMs: POLL_IDLE_MS, staleAfterSeconds: STALE_AFTER_SECONDS });

  try {
    while (!shuttingDown) {
      const recovered = await recoverStaleJobs(db, STALE_AFTER_SECONDS).catch((error) => {
        logError("recover_stale_failed", error);
        return 0;
      });
      if (recovered > 0) log("recovered_stale", { count: recovered });

      const job = await claimNextJob(db, "pdf_batch").catch((error) => {
        logError("claim_failed", error);
        return null;
      });

      if (!job) {
        await sleep(POLL_IDLE_MS);
        continue;
      }

      try {
        const result = await processPdfBatchJob(job);
        await markJobDone(db, job.id, { ...result });
        log("job_done", { jobId: job.id, documentId: result.documentId });
      } catch (error) {
        if (job.attempts >= MAX_ATTEMPTS) {
          await discardPdfBatchDocument(job).catch((discardError) =>
            logError("discard_failed", discardError),
          );
          await markJobFailed(db, job.id, {
            message: errorMessage(error),
            attempts: job.attempts,
          });
          logError("job_failed", error);
        } else {
          await returnJobToPending(db, job.id);
          log("job_retry", { jobId: job.id, attempts: job.attempts });
        }
      }
    }
  } finally {
    await close();
    log("stopped");
  }
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (!shuttingDown) log("shutdown_requested", { signal });
    shuttingDown = true;
  });
}

main().catch((error) => {
  logError("fatal", error);
  process.exit(1);
});
