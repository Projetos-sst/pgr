"use server";

import { revalidatePath } from "next/cache";

import {
  enqueuePgrPdfBatchSchema,
  type EnqueuePgrPdfBatchInput,
} from "@/shared/domains/documents/pdf-batch";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import { enqueuePgrPdf, type EnqueuedPgrPdf } from "@/shared/db/repositories/pdf-batch";

const BASE_PATH = "/documents";

/**
 * Enfileira a geração em lote de PDFs de PGR — 1 job por documento (gate #39).
 * Responde imediatamente (Princípio IV); o worker processa depois. PGR
 * inexistente/cross-tenant → `FK_NOT_FOUND`.
 */
export async function enqueuePgrPdfBatchAction(
  pgrIds: EnqueuePgrPdfBatchInput,
): Promise<ActionResult<EnqueuedPgrPdf[]>> {
  return officeAction(
    "documents.pdf_batch.enqueue",
    async ({ tenantId }) => {
      const ids = enqueuePgrPdfBatchSchema.parse(pgrIds);
      const enqueued: EnqueuedPgrPdf[] = [];
      for (const pgrId of ids) {
        enqueued.push(await enqueuePgrPdf(tenantId, pgrId));
      }
      revalidatePath(BASE_PATH);
      return enqueued;
    },
    { audit: true },
  );
}
