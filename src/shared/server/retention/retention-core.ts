import "server-only";

import { ForbiddenError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import * as repo from "@/shared/db/repositories/retention-policy";
import {
  PROPOSED_RETENTION_TERMS,
  RETENTION_CATEGORIES,
  retentionPolicyState,
  retentionPolicyVersionSchema,
  retentionTermsSha256,
  type RetentionApproval,
} from "@/shared/domains/retention/policy";
import {
  computeRetentionSchedule,
  discardGate,
  retentionMarkersSchema,
} from "@/shared/domains/retention/schedule";
import { DiscardBlockedError } from "@/shared/errors/discard-blocked-error";
import { ValidationError } from "@/shared/errors/validation-error";
import type { PageParams } from "@/shared/pagination";
import { z } from "zod";

const OWNER_ONLY = "Somente o administrador do escritório registra a política de guarda.";
const DISCARD_OWNER_ONLY = "Somente o administrador do escritório autoriza descarte.";
const NO_APPROVAL = {
  approverName: null,
  approverRole: null,
  approvedOn: null,
  approvalReference: null,
};

const discardRequestSchema = z.object({
  category: z.enum(RETENTION_CATEGORIES, "Categoria desconhecida."),
  markers: retentionMarkersSchema,
});

function approvalColumns(approval: RetentionApproval, today: string) {
  if (approval.approvedOn > today)
    throw new ValidationError("A data da aprovação não pode ser futura.");
  return {
    approverName: approval.approverName,
    approverRole: approval.approverRole,
    approvedOn: approval.approvedOn,
    approvalReference: approval.reference,
  };
}

export async function getRetentionPolicy(ctx: TenantContext, page: PageParams = {}) {
  const { rows, total, current } = await repo.listRetentionPolicyVersions(ctx, page);
  return {
    state: retentionPolicyState(current),
    current,
    rows,
    total,
    proposal: PROPOSED_RETENTION_TERMS,
    canRecord: ctx.role === "owner",
  };
}

export async function recordRetentionPolicyVersion(ctx: TenantContext, input: unknown) {
  if (ctx.role !== "owner") throw new ForbiddenError(OWNER_ONLY);
  const data = retentionPolicyVersionSchema.parse(input);
  const approval =
    data.status === "approved"
      ? approvalColumns(data.approval, todayInSaoPaulo())
      : NO_APPROVAL;
  return repo.insertRetentionPolicyVersion(ctx, {
    status: data.status,
    terms: data.terms,
    termsSha256: retentionTermsSha256(data.terms),
    ...approval,
  });
}

export async function simulateRetention(ctx: TenantContext, input: unknown) {
  const markers = retentionMarkersSchema.parse(input);
  const current = await repo.getLatestRetentionPolicyVersion(ctx);
  const state = retentionPolicyState(current);
  const today = todayInSaoPaulo();
  return {
    state,
    provisional: state.status !== "approved",
    termsSource: current ? ("registered" as const) : ("proposal" as const),
    today,
    rows: computeRetentionSchedule(
      current?.terms ?? PROPOSED_RETENTION_TERMS,
      markers,
    ).map((row) => ({ ...row, discard: discardGate(state, row, today) })),
  };
}

export async function assertDiscardAuthorized(
  ctx: TenantContext,
  input: unknown,
): Promise<void> {
  if (ctx.role !== "owner") throw new ForbiddenError(DISCARD_OWNER_ONLY);
  const { category, markers } = discardRequestSchema.parse(input);
  const simulation = await simulateRetention(ctx, markers);
  const row = simulation.rows.find((candidate) => candidate.category === category);
  if (!row?.discard.allowed) throw new DiscardBlockedError();
}
