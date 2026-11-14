"use server";
import { revalidatePath } from "next/cache";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/pgr/document-approval-core";

function write<T>(
  operation: string,
  pgrId: string,
  run: (ctx: TenantContext) => Promise<T>,
) {
  return officeAction(
    operation,
    async (ctx) => {
      const result = await run(ctx);
      revalidatePath(`/pgr/${pgrId}/reviews`);
      revalidatePath(`/pgr/${pgrId}`);
      return result;
    },
    { audit: true },
  );
}
export async function getDocumentApprovalAction(pgrId: string) {
  return officeAction("pgr.document_approval.get", (ctx) =>
    core.getDocumentApproval(ctx, pgrId),
  );
}
export async function requireDocumentReviewAction(pgrId: string, input: unknown) {
  return write("pgr.document_approval.require", pgrId, (ctx) =>
    core.requireDocumentReview(ctx, pgrId, input),
  );
}
export async function assignDocumentReviewerAction(pgrId: string, input: unknown) {
  return write("pgr.document_approval.assign", pgrId, (ctx) =>
    core.assignDocumentReviewer(ctx, pgrId, input),
  );
}
export async function revokeDocumentReviewerAction(pgrId: string, input: unknown) {
  return write("pgr.document_approval.revoke", pgrId, (ctx) =>
    core.revokeDocumentReviewer(ctx, pgrId, input),
  );
}
export async function decideDocumentApprovalAction(pgrId: string, input: unknown) {
  return write("pgr.document_approval.decide", pgrId, (ctx) =>
    core.decideDocumentApproval(ctx, pgrId, input),
  );
}
export async function cancelFinalIssueAction(
  pgrId: string,
  issueId: string,
  input: unknown,
) {
  return write("pgr.document_approval.cancel_issue", pgrId, (ctx) =>
    core.cancelFinalIssue(ctx, pgrId, issueId, input),
  );
}
