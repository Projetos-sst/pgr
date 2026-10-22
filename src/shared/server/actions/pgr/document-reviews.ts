"use server";
import { revalidatePath } from "next/cache";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/pgr/document-review-core";
import type { PageParams } from "@/shared/pagination";
export async function listReviewSamplesAction(pgrId: string, page: PageParams = {}) {
  return officeAction("pgr.review.list", (ctx) =>
    core.listReviewSamples(ctx, pgrId, page),
  );
}
export async function getReviewSampleAction(
  pgrId: string,
  sampleId: string,
  page: PageParams = {},
) {
  return officeAction("pgr.review.get", (ctx) =>
    core.getReviewSample(ctx, pgrId, sampleId, page),
  );
}
export async function createReviewSampleAction(pgrId: string, input: unknown) {
  return officeAction(
    "pgr.review.sample",
    async (ctx) => {
      const row = await core.createReviewSample(ctx, pgrId, input);
      revalidatePath(`/pgr/${pgrId}/reviews`);
      return { id: row.id, documentId: row.documentId };
    },
    { audit: true },
  );
}
export async function recordReviewDecisionAction(
  pgrId: string,
  sampleId: string,
  input: unknown,
) {
  return officeAction(
    "pgr.review.decision",
    async (ctx) => {
      const row = await core.recordReviewDecision(ctx, pgrId, sampleId, input);
      revalidatePath(`/pgr/${pgrId}/reviews`);
      revalidatePath(`/pgr/${pgrId}/reviews/${sampleId}`);
      return row;
    },
    { audit: true },
  );
}
