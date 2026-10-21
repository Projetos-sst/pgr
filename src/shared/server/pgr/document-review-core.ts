import "server-only";
import { randomUUID } from "node:crypto";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  pgrReviewSampleSchema,
  pgrReviewDecisionSchema,
} from "@/shared/domains/pgr/document-review";
import * as repo from "@/shared/db/repositories/pgr-document-reviews";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";
import {
  putDocumentObject,
  removeDocumentObject,
} from "@/shared/integrations/storage/documents-storage";
import { ReportUnavailableError } from "@/shared/errors/report-unavailable-error";
import { getPgrReadiness } from "./pgr-readiness-core";
import type { PageParams } from "@/shared/pagination";
const id = (value: string) => requiredUuid("Identificador inválido.").parse(value);
export async function createReviewSample(
  ctx: TenantContext,
  pgrId: string,
  input: unknown,
) {
  const pgr = id(pgrId);
  const data = pgrReviewSampleSchema.parse(input);
  if (data.supersedesSampleId)
    await repo.getPgrReviewSample(ctx, pgr, data.supersedesSampleId, { pageSize: 1 });
  const generated = await generatePgrDocx(ctx.tenantId, pgr, {
    purpose: "preview",
    format: "docx",
  });
  if (!generated.reviewSnapshot || !generated.provenance.snapshotSha256)
    throw new ReportUnavailableError();
  const group = randomUUID();
  const stored = await putDocumentObject(
    ctx.tenantId,
    group,
    1,
    new File([new Uint8Array(generated.file)], generated.fileName, {
      type: generated.contentType,
    }),
  );
  try {
    return await repo.createPgrReviewSample(ctx, pgr, data, {
      fileName: generated.fileName,
      ...stored,
      documentGroupId: group,
      snapshot: generated.reviewSnapshot,
      snapshotSha256: generated.provenance.snapshotSha256,
      templateSha256: generated.provenance.templateSha256,
      fileSha256: generated.provenance.fileSha256,
    });
  } catch (error) {
    await removeDocumentObject(stored.storagePath).catch(() => {});
    throw error;
  }
}
export async function listReviewSamples(
  ctx: TenantContext,
  pgrId: string,
  page: PageParams = {},
) {
  const pgr = id(pgrId);
  const rows = await repo.listPgrReviewSamples(ctx, pgr, page);
  const current = await getPgrReadiness(ctx.tenantId, pgr);
  return {
    ...rows,
    canRecordDecision: ctx.role === "owner",
    rows: rows.rows.map((row) => ({
      ...row,
      sourceChanged: row.snapshotSha256 !== current.sourceSha256,
    })),
  };
}
export async function getReviewSample(
  ctx: TenantContext,
  pgrId: string,
  sampleId: string,
  page: PageParams = {},
) {
  const pgr = id(pgrId);
  const view = await repo.getPgrReviewSample(ctx, pgr, id(sampleId), page);
  const current = await getPgrReadiness(ctx.tenantId, pgr);
  return {
    ...view,
    canRecordDecision: ctx.role === "owner",
    sourceChanged: view.sample.snapshotSha256 !== current.sourceSha256,
  };
}
export async function recordReviewDecision(
  ctx: TenantContext,
  pgrId: string,
  sampleId: string,
  input: unknown,
) {
  return repo.recordPgrReviewDecision(
    ctx,
    id(pgrId),
    id(sampleId),
    pgrReviewDecisionSchema.parse(input),
  );
}
