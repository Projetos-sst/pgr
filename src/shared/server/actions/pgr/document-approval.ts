"use server";
import { revalidatePath } from "next/cache";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/pgr/document-approval-core";
import { getReviewSample } from "@/shared/server/pgr/document-review-core";
import { getDocumentById } from "@/shared/db/repositories/documents";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { assertPgrBillingExportAllowed } from "@/shared/db/repositories/billing-export";
import { getSignedDownloadUrl } from "@/shared/integrations/storage/documents-storage";
export async function getDocumentApprovalAction(pgrId: string) {
  return officeAction(
    "pgr.document_approval.get",
    (ctx) => core.documentApprovalOverview(ctx, pgrId),
    { tenantAccess: true },
  );
}
export async function assignDocumentReviewerAction(pgrId: string, input: unknown) {
  return officeAction(
    "pgr.document_approval.assign",
    async (ctx) => {
      const row = await core.assignReviewer(ctx, pgrId, input);
      revalidatePath(`/pgr/${pgrId}/reviews`);
      return row;
    },
    { audit: true },
  );
}
export async function decideDocumentApprovalAction(pgrId: string, input: unknown) {
  return officeAction(
    "pgr.document_approval.decide",
    async (ctx) => {
      const row = await core.approveDocument(ctx, pgrId, input);
      revalidatePath(`/pgr/${pgrId}/reviews`);
      return row;
    },
    { audit: true, tenantAccess: true },
  );
}
export async function addRestrictedReviewerAction(pgrId: string, input: unknown) {
  return officeAction(
    "pgr.document_approval.restricted_reviewer",
    async (ctx) => {
      const result = await core.registerRestrictedReviewer(ctx, pgrId, input);
      revalidatePath(`/pgr/${pgrId}/reviews`);
      return result;
    },
    { audit: true },
  );
}
export async function downloadReviewSampleAction(pgrId: string, sampleId: string) {
  return officeAction(
    "pgr.document_approval.sample_download",
    async (ctx) => {
      const view = await getReviewSample(ctx, pgrId, sampleId, { pageSize: 1 });
      await assertPgrBillingExportAllowed(ctx.tenantId, pgrId);
      const document = await getDocumentById(ctx.tenantId, view.sample.documentId);
      if (
        !document ||
        document.relatedEntityType !== "pgr" ||
        document.relatedEntityId !== pgrId
      )
        throw new NotFoundError();
      return {
        url: await getSignedDownloadUrl(document.storagePath, {
          downloadName: document.name,
        }),
      };
    },
    { tenantAccess: true, audit: true },
  );
}
export async function revokeRestrictedReviewerAction(pgrId: string, input: unknown) {
  return officeAction(
    "pgr.document_approval.restricted_reviewer_revoked",
    async (ctx) => {
      const result = await core.revokeRestrictedReviewer(ctx, pgrId, input);
      revalidatePath(`/pgr/${pgrId}/reviews`);
      return result;
    },
    { audit: true },
  );
}
