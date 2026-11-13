import "server-only";
import { randomUUID } from "node:crypto";
import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/pgr-document-approvals";
import { getPgrGenerationSnapshot } from "@/shared/db/repositories/pgr-generation-snapshot";
import { runAsActor } from "@/shared/db/session-actor";
import {
  approvalDecisionSchema,
  deriveApprovalState,
  finalIssueBlock,
  issueCancellationSchema,
  listFinalIssues,
  reviewRequirementSchema,
  reviewerAssignmentSchema,
  reviewerRevocationSchema,
  transitionBlock,
  type ApprovalEvent,
  type ApprovalEventKind,
  type ApprovalState,
  type DocumentVersion,
} from "@/shared/domains/pgr/document-approval";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import {
  putDocumentObject,
  removeDocumentObject,
} from "@/shared/integrations/storage/documents-storage";
import {
  generatePgrDocx,
  pgrDocxTemplateSha256,
  type FinalIssueReview,
  type GeneratePgrDocxOptions,
  type GeneratedPgrDocx,
} from "@/shared/server/platform/pgr-docx-core";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import { pgrSnapshotHash } from "./pgr-readiness-core";

type WriteScope = repo.ApprovalWriteScope & {
  state: ApprovalState;
  version: DocumentVersion;
};
type ReviewedGeneration = {
  generated: GeneratedPgrDocx;
  review: FinalIssueReview;
  snapshot: Record<string, unknown>;
  version: DocumentVersion;
};

const uuid = (value: string, message: string) => requiredUuid(message).parse(value);
const pgrKey = (value: string) => uuid(value, "PGR inválido.");

function requireAdministrator(ctx: TenantContext, message: string): void {
  if (ctx.role !== "owner") throw new ForbiddenError(message);
}

function assertTransition(state: ApprovalState, kind: ApprovalEventKind): void {
  const block = transitionBlock(state, kind);
  if (block) throw new ValidationError(block);
}

function assignmentFor(state: ApprovalState, kind: ApprovalEventKind): ApprovalEvent {
  assertTransition(state, kind);
  if (!("assignment" in state))
    throw new ValidationError("Não há revisor designado neste PGR.");
  return state.assignment;
}

async function currentVersion(orgId: string, pgrId: string): Promise<DocumentVersion> {
  const snapshot = await getPgrGenerationSnapshot(orgId, pgrId);
  if (!snapshot) throw new NotFoundError();
  return {
    snapshotSha256: pgrSnapshotHash(snapshot),
    templateSha256: await pgrDocxTemplateSha256(),
  };
}

function writeEvent(
  ctx: TenantContext,
  pgrId: string,
  build: (scope: WriteScope) => Promise<repo.NewApprovalEvent>,
): Promise<ApprovalEvent> {
  return runAsActor(ctx.userId, async () => {
    const version = await currentVersion(ctx.tenantId, pgrId);
    return repo.appendApprovalEvent(ctx, pgrId, (scope) =>
      build({ ...scope, version, state: deriveApprovalState(scope.events, version) }),
    );
  });
}

function resolveAuthor(createdBy: string | null, declared: string | undefined): string {
  if (createdBy && declared && declared !== createdBy)
    throw new ValidationError("O elaborador deve ser a conta que criou o PGR.");
  const author = createdBy ?? declared;
  if (!author)
    throw new ValidationError(
      "Este PGR não tem elaborador registrado. Informe quem elaborou o documento.",
    );
  return author;
}

export async function requireDocumentReview(
  ctx: TenantContext,
  pgrId: string,
  input: unknown,
): Promise<ApprovalEvent> {
  const data = reviewRequirementSchema.parse(input);
  return writeEvent(ctx, pgrKey(pgrId), async ({ state }) => {
    requireAdministrator(
      ctx,
      "Somente o administrador ativa a revisão obrigatória do PGR.",
    );
    assertTransition(state, "required");
    return { kind: "required", reason: data.reason };
  });
}

export async function assignDocumentReviewer(
  ctx: TenantContext,
  pgrId: string,
  input: unknown,
): Promise<ApprovalEvent> {
  const key = pgrKey(pgrId);
  const data = reviewerAssignmentSchema.parse(input);
  return writeEvent(ctx, key, async ({ tx, head, state }) => {
    requireAdministrator(ctx, "Somente o administrador designa o revisor.");
    assertTransition(state, "assigned");
    const authorUserId = resolveAuthor(head.createdBy, data.authorUserId);
    if (authorUserId === data.reviewerUserId)
      throw new ValidationError("O elaborador não pode revisar o próprio PGR.");
    const members = head.createdBy
      ? [data.reviewerUserId]
      : [data.reviewerUserId, authorUserId];
    for (const userId of members)
      if (!(await repo.canReviewPgr(tx, ctx, key, userId)))
        throw new ValidationError(
          "Elaborador e revisor devem ser membros do escritório com acesso a este PGR.",
        );
    return {
      kind: "assigned",
      authorUserId,
      reviewerUserId: data.reviewerUserId,
      reviewerIdentity: data.reviewer,
      reason: data.reason,
    };
  });
}

export async function revokeDocumentReviewer(
  ctx: TenantContext,
  pgrId: string,
  input: unknown,
): Promise<ApprovalEvent> {
  const data = reviewerRevocationSchema.parse(input);
  return writeEvent(ctx, pgrKey(pgrId), async ({ state }) => {
    requireAdministrator(ctx, "Somente o administrador revoga o revisor.");
    const assignment = assignmentFor(state, "revoked");
    return { kind: "revoked", assignmentId: assignment.id, reason: data.reason };
  });
}

export async function decideDocumentApproval(
  ctx: TenantContext,
  pgrId: string,
  input: unknown,
): Promise<ApprovalEvent> {
  const data = approvalDecisionSchema.parse(input);
  return writeEvent(ctx, pgrKey(pgrId), async ({ head, state, version }) => {
    const assignment = assignmentFor(state, data.verdict);
    if (assignment.reviewerUserId !== ctx.userId || head.createdBy === ctx.userId)
      throw new ForbiddenError(
        "Somente o revisor designado registra o próprio parecer; o elaborador não aprova o próprio PGR.",
      );
    if (assignment.id !== data.assignmentId)
      throw new ValidationError(
        "A designação mudou. Atualize a página antes de registrar o parecer.",
      );
    if (version.snapshotSha256 !== data.snapshotSha256)
      throw new ValidationError(
        "Os dados mudaram depois que a revisão foi aberta. Confira a versão atual antes de registrar o parecer.",
      );
    return {
      kind: data.verdict,
      assignmentId: assignment.id,
      authorUserId: assignment.authorUserId,
      reviewerUserId: assignment.reviewerUserId,
      ...version,
      reason: data.reason || null,
    };
  });
}

export async function cancelFinalIssue(
  ctx: TenantContext,
  pgrId: string,
  issueId: string,
  input: unknown,
): Promise<ApprovalEvent> {
  const issueKey = uuid(issueId, "Emissão inválida.");
  const data = issueCancellationSchema.parse(input);
  return writeEvent(ctx, pgrKey(pgrId), async ({ events }) => {
    requireAdministrator(ctx, "Somente o administrador cancela uma emissão final.");
    const issue = listFinalIssues(events).find((item) => item.id === issueKey);
    if (!issue) throw new NotFoundError();
    if (issue.status === "cancelled")
      throw new ValidationError("Esta emissão final já foi cancelada.");
    return { kind: "issue_cancelled", cancelledIssueId: issue.id, reason: data.reason };
  });
}

export async function getDocumentApproval(ctx: TenantContext, pgrId: string) {
  const key = pgrKey(pgrId);
  return runAsActor(ctx.userId, async () => {
    const version = await currentVersion(ctx.tenantId, key);
    const { head, events } = await repo.getApprovalContext(ctx, key);
    const state = deriveApprovalState(events, version);
    const assignment = "assignment" in state ? state.assignment : null;
    const decision = "decision" in state ? state.decision : null;
    const administrator = ctx.role === "owner";
    return {
      status: state.status,
      version,
      authorUserId: assignment?.authorUserId ?? head.createdBy,
      assignmentId: assignment?.id ?? null,
      reviewer: assignment && {
        userId: assignment.reviewerUserId,
        identity: assignment.reviewerIdentity,
      },
      decision: decision && {
        id: decision.id,
        verdict: decision.kind,
        reason: decision.reason,
        decidedAt: decision.createdAt,
        snapshotSha256: decision.snapshotSha256,
        templateSha256: decision.templateSha256,
      },
      history: events,
      issues: listFinalIssues(events),
      permissions: {
        canRequire: administrator && state.status === "not_required",
        canAssign: administrator && state.status !== "not_required",
        canRevoke: administrator && assignment !== null,
        canDecide:
          assignment?.reviewerUserId === ctx.userId && head.createdBy !== ctx.userId,
        canCancelIssue: administrator,
      },
    };
  });
}

export async function assertPgrApprovalCurrent(
  orgId: string,
  pgrId: string,
): Promise<void> {
  const events = await repo.listApprovalEvents(orgId, pgrId);
  if (events.length === 0) return;
  const state = deriveApprovalState(events, await currentVersion(orgId, pgrId));
  const block = finalIssueBlock(state);
  if (block) throw new ValidationError(block);
}

async function archiveFinalIssue(
  ctx: TenantContext,
  pgrId: string,
  { generated, review, snapshot, version }: ReviewedGeneration,
): Promise<ApprovalEvent> {
  const documentGroupId = randomUUID();
  const stored = await putDocumentObject(
    ctx.tenantId,
    documentGroupId,
    1,
    new File([new Uint8Array(generated.file)], generated.fileName, {
      type: generated.contentType,
    }),
  );
  return repo
    .appendApprovalEvent(ctx, pgrId, async ({ tx, events }) => {
      const state = deriveApprovalState(events, version);
      assertTransition(state, "issued");
      if (!("decision" in state) || state.decision.id !== review.decision.id)
        throw new ValidationError(
          "A revisão mudou durante a emissão. Confira o parecer e emita novamente.",
        );
      const documentId = await repo.insertFinalIssueDocument(tx, ctx, pgrId, {
        name: `${generated.title} — emissão final`,
        documentGroupId,
        ...stored,
      });
      const replaced = listFinalIssues(events).find((item) => item.status === "current");
      return {
        kind: "issued",
        assignmentId: state.assignment.id,
        decisionId: state.decision.id,
        supersedesIssueId: replaced?.id ?? null,
        documentId,
        fileSha256: generated.provenance.fileSha256,
        ...version,
        snapshot,
      };
    })
    .catch(async (error: unknown) => {
      await removeDocumentObject(stored.storagePath).catch(() =>
        logTenantEvent("error", {
          operation: "pgr.document_approval.issue_cleanup",
          outcome: "rejected",
          orgId: ctx.tenantId,
          userId: ctx.userId,
        }),
      );
      throw error;
    });
}

export async function issuePgrDocument(
  ctx: TenantContext,
  pgrId: string,
  options: GeneratePgrDocxOptions,
): Promise<GeneratedPgrDocx & { issue: ApprovalEvent | null }> {
  const key = pgrKey(pgrId);
  return runAsActor(ctx.userId, async () => {
    const generated = await generatePgrDocx(ctx.tenantId, key, options);
    const { review, reviewSnapshot, provenance } = generated;
    if (!review || !reviewSnapshot || !provenance.snapshotSha256)
      return { ...generated, issue: null };
    const issue = await archiveFinalIssue(ctx, key, {
      generated,
      review,
      snapshot: reviewSnapshot,
      version: {
        snapshotSha256: provenance.snapshotSha256,
        templateSha256: provenance.templateSha256,
      },
    });
    return { ...generated, issue };
  });
}
