import "server-only";

import { and, count, desc, eq } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  PROVISIONAL_TRIAL_POLICY,
  trialStatus,
  trialWindow,
  type TrialFilters,
  type TrialStatus,
  type TrialWindowRecord,
} from "@/shared/domains/commercial/trial";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { resolvePageParams, type Paginated } from "@/shared/pagination";

import { commercialEntitlements } from "../schema/billing";
import { commercialTrials } from "../schema/commercial";
import { companies } from "../schema/companies";
import { pgr } from "../schema/pgr";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const trials = commercialTrials;

const columns = {
  id: trials.id,
  companyId: trials.companyId,
  startedAt: trials.startedAt,
  endsAt: trials.endsAt,
  days: trials.days,
  startedBy: trials.startedBy,
  convertedAt: trials.convertedAt,
};

export type CommercialTrialRow = TrialWindowRecord & {
  id: string;
  companyId: string;
  startedAt: Date;
  days: number;
  startedBy: string;
};

export type CommercialTrial = CommercialTrialRow & { status: TrialStatus };

export type StartedTrial = { trial: CommercialTrial; created: boolean };

export type EmissionFacts = { trial: CommercialTrialRow | null; hasPaidPgr: boolean };

function withStatus(row: CommercialTrialRow, now: Date): CommercialTrial {
  return { ...row, status: trialStatus(row, now) };
}

async function assertCompanyVisible(tx: TenantTransaction, orgId: string, id: string) {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), eq(companies.id, id)));
  if (!company) throw new NotFoundError();
}

async function findTrial(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
): Promise<CommercialTrialRow | null> {
  const [row] = await tx
    .select(columns)
    .from(trials)
    .where(and(eq(trials.orgId, orgId), eq(trials.companyId, companyId)));
  return row ?? null;
}

export async function hasActivePaidEntitlement(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  service: "pgr",
): Promise<boolean> {
  const [row] = await tx
    .select({ id: commercialEntitlements.id })
    .from(commercialEntitlements)
    .where(
      and(
        eq(commercialEntitlements.orgId, orgId),
        eq(commercialEntitlements.companyId, companyId),
        eq(commercialEntitlements.service, service),
        eq(commercialEntitlements.status, "active"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export function startTrial(
  ctx: TenantContext,
  companyId: string,
  now: Date = new Date(),
): Promise<StartedTrial> {
  return auditedTenantWrite(ctx.tenantId, "commercial.trial.create", () =>
    withOrg(ctx.tenantId, async (tx) => {
      await assertCompanyVisible(tx, ctx.tenantId, companyId);
      const inserted = await tx
        .insert(trials)
        .values({
          orgId: ctx.tenantId,
          companyId,
          startedAt: now,
          endsAt: trialWindow(now, PROVISIONAL_TRIAL_POLICY.days).endsAt,
          days: PROVISIONAL_TRIAL_POLICY.days,
          startedBy: ctx.userId,
        })
        .onConflictDoNothing({ target: [trials.orgId, trials.companyId] })
        .returning({ id: trials.id });
      const row = await findTrial(tx, ctx.tenantId, companyId);
      if (!row) throw new NotFoundError();
      return { trial: withStatus(row, now), created: inserted.length > 0 };
    }),
  );
}

export function getTrial(
  ctx: TenantContext,
  companyId: string,
  now: Date = new Date(),
): Promise<CommercialTrial> {
  return withOrg(ctx.tenantId, async (tx) => {
    await assertCompanyVisible(tx, ctx.tenantId, companyId);
    const row = await findTrial(tx, ctx.tenantId, companyId);
    if (!row) throw new NotFoundError();
    return withStatus(row, now);
  });
}

export function listTrials(
  ctx: TenantContext,
  filters: TrialFilters = {},
  now: Date = new Date(),
): Promise<Paginated<CommercialTrial>> {
  return withOrg(ctx.tenantId, async (tx) => {
    const { limit, offset } = resolvePageParams(filters);
    const where = eq(trials.orgId, ctx.tenantId);
    const rows = await tx
      .select(columns)
      .from(trials)
      .where(where)
      .orderBy(desc(trials.startedAt), desc(trials.id))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx.select({ total: count() }).from(trials).where(where);
    return { rows: rows.map((row) => withStatus(row, now)), total };
  });
}

export function readEmissionFacts(
  orgId: string,
  pgrId: string,
): Promise<EmissionFacts | null> {
  return withOrg(orgId, async (tx) => {
    const [head] = await tx
      .select({ companyId: pgr.companyId })
      .from(pgr)
      .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)));
    if (!head) return null;
    const trial = await findTrial(tx, orgId, head.companyId);
    const hasPaidPgr = await hasActivePaidEntitlement(tx, orgId, head.companyId, "pgr");
    return { trial, hasPaidPgr };
  });
}
