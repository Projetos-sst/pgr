import "server-only";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  documentReviewerSchema,
  documentApprovalSchema,
  checkDocumentApproval,
} from "@/shared/domains/pgr/document-approval";
import { PGR_DOCX_TEMPLATE_FILE } from "@/shared/domains/pgr/pgr-docx/template-file";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ForbiddenError } from "@/shared/auth/errors";
import { ValidationError } from "@/shared/errors/validation-error";
import { z } from "zod";
import { findVerifiedReviewerAccount } from "@/shared/integrations/clerk/reviewer-account";
import { getPgrById } from "@/shared/db/repositories/pgr";
import { getPgrGenerationSnapshot } from "@/shared/db/repositories/pgr-generation-snapshot";
import * as repo from "@/shared/db/repositories/pgr-document-approvals";
import { pgrSnapshotHash } from "./pgr-readiness-core";
const id = (value: string) => requiredUuid("PGR inválido.").parse(value);
export async function currentPgrTemplateHash() {
  return createHash("sha256")
    .update(
      await readFile(
        path.join(/*turbopackIgnore: true*/ process.cwd(), PGR_DOCX_TEMPLATE_FILE),
      ),
    )
    .digest("hex");
}
export async function assertPgrDocumentApproval(orgId: string, pgrId: string) {
  const snapshot = await getPgrGenerationSnapshot(orgId, pgrId);
  if (!snapshot) throw new NotFoundError();
  if (snapshot.approval.assignment || snapshot.approval.required)
    checkDocumentApproval(
      snapshot.approval,
      pgrSnapshotHash(snapshot),
      await currentPgrTemplateHash(),
    );
}
export async function assignReviewer(ctx: TenantContext, pgrId: string, input: unknown) {
  return repo.assignDocumentReviewer(ctx, id(pgrId), documentReviewerSchema.parse(input));
}
export async function approveDocument(ctx: TenantContext, pgrId: string, input: unknown) {
  const key = id(pgrId);
  const data = documentApprovalSchema.parse(input);
  await repo.assertDocumentReviewAccess(ctx, key);
  const snapshot = await getPgrGenerationSnapshot(ctx.tenantId, key, ctx.userId);
  if (!snapshot) throw new NotFoundError();
  return repo.decideDocumentApproval(
    ctx,
    key,
    data,
    pgrSnapshotHash(snapshot),
    await currentPgrTemplateHash(),
  );
}
export async function documentApprovalOverview(ctx: TenantContext, pgrId: string) {
  const key = id(pgrId);
  await repo.assertDocumentReviewAccess(ctx, key);
  const snapshot = await getPgrGenerationSnapshot(ctx.tenantId, key, ctx.userId);
  if (!snapshot) throw new NotFoundError();
  return {
    ...snapshot.approval,
    canAssign: ctx.role === "owner",
    canReview:
      snapshot.approval.assignment?.reviewerUserId === ctx.userId &&
      snapshot.approval.assignment.authorUserId !== ctx.userId,
  };
}
export async function registerRestrictedReviewer(
  ctx: TenantContext,
  pgrId: string,
  raw: unknown,
) {
  if (ctx.role !== "owner")
    throw new ForbiddenError("Somente o administrador pode designar acesso de revisão.");
  const key = id(pgrId);
  const { email } = z
    .object({ email: z.string().trim().toLowerCase().pipe(z.email()) })
    .strict()
    .parse(raw);
  if (!(await getPgrById(ctx.tenantId, key))) throw new NotFoundError();
  const userId = await findVerifiedReviewerAccount(email);
  if (!userId)
    throw new ValidationError(
      "O profissional deve criar sua conta e verificar este e-mail antes de receber o acesso restrito.",
    );
  return repo.addRestrictedDocumentReviewer(ctx, key, userId);
}
export async function revokeRestrictedReviewer(
  ctx: TenantContext,
  pgrId: string,
  raw: unknown,
) {
  const { userId } = z
    .object({ userId: z.string().trim().min(1).max(200) })
    .strict()
    .parse(raw);
  await repo.revokeRestrictedDocumentReviewer(ctx, id(pgrId), userId);
  return { revoked: true };
}
