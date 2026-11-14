import "server-only";

import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import {
  entitlementsChangedCount,
  mirrorFieldsChanged,
  reconciliationResult,
  subscriptionDivergence,
  type AdminEntitlement,
  type AdminLastEvent,
  type AdminPriceItem,
  type AdminService,
  type AdminSubscriptionDetail,
  type AdminSubscriptionFilters,
  type AdminSubscriptionRow,
  type ReconcileOutcome,
  type SubscriptionLookup,
} from "@/shared/domains/commercial/admin-subscriptions";
import type { SubscriptionStatus } from "@/shared/domains/commercial/billing-model";
import type { SubscriptionEvent } from "@/shared/domains/commercial/provider-event";
import type { SubscriptionMirror } from "@/shared/domains/commercial/subscription";
import type { Paginated } from "@/shared/pagination";
import { resolvePageParams } from "@/shared/pagination";
import { NotFoundError } from "@/shared/errors/not-found-error";

import {
  billingEvents,
  billingSubscriptions,
  commercialEntitlements,
  commercialReconciliations,
} from "../schema/billing";
import { commercialContractItems, commercialContracts } from "../schema/commercial";
import { users } from "../schema/users";
import { withOrg, type TenantTransaction } from "../with-org";
import { withPlatformOperator } from "../with-platform-operator";
import {
  contractScope,
  loadMirror,
  mirrorSubscription,
  syncEntitlements,
  type EventContext,
} from "./billing-ledger";

const subs = billingSubscriptions;
const rights = commercialEntitlements;
const contracts = commercialContracts;
const items = commercialContractItems;

const iso = (value: Date | null) => (value ? value.toISOString() : null);

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

const hasService = (service: AdminService) =>
  sql`exists(select 1 from ${items} i where i.contract_id = ${subs.contractId} and i.org_id = ${subs.orgId} and i.service = ${service})`;

const hasCompany = (companyId: string) =>
  sql`exists(select 1 from ${rights} e where e.contract_id = ${subs.contractId} and e.org_id = ${subs.orgId} and e.company_id = ${companyId})`;

const matchesSearch = (term: string) => {
  const needle = term.toLowerCase();
  return sql`(strpos(lower(${subs.providerSubscriptionId}), ${needle}) > 0 or strpos(lower(coalesce(${subs.providerCustomerId}, '')), ${needle}) > 0)`;
};

function filterCondition(filters: AdminSubscriptionFilters) {
  return and(
    filters.orgId ? eq(subs.orgId, filters.orgId) : undefined,
    filters.status ? eq(subs.status, filters.status) : undefined,
    filters.service ? hasService(filters.service) : undefined,
    filters.companyId ? hasCompany(filters.companyId) : undefined,
    filters.from ? sql`${subs.currentPeriodEnd} >= ${filters.from}::date` : undefined,
    filters.to ? sql`${subs.currentPeriodStart} < (${filters.to}::date + 1)` : undefined,
    filters.search ? matchesSearch(filters.search) : undefined,
  );
}

export async function isPlatformOperator(userId: string): Promise<boolean> {
  const found = await withPlatformOperator(userId, (tx) =>
    tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isMaster, true))),
  );
  return found.length > 0;
}

type PriceRow = AdminPriceItem & { contractId: string };

const priceItems = (rows: readonly PriceRow[]): AdminPriceItem[] =>
  rows.map(({ position, service, label, unit, unitAmountCents }) => ({
    position,
    service,
    label,
    unit,
    unitAmountCents,
  }));

async function pageRelations(tx: TenantTransaction, ids: string[]) {
  const priceRows = await tx
    .select({
      contractId: items.contractId,
      position: items.position,
      service: items.service,
      label: items.label,
      unit: items.unit,
      unitAmountCents: items.unitAmountCents,
    })
    .from(items)
    .where(inArray(items.contractId, ids))
    .orderBy(items.position);
  const rightRows = await tx
    .select({ contractId: rights.contractId, status: rights.status })
    .from(rights)
    .where(inArray(rights.contractId, ids));
  const eventRows = await tx
    .selectDistinctOn([billingEvents.contractId], {
      contractId: billingEvents.contractId,
      type: billingEvents.type,
      outcome: billingEvents.outcome,
      occurredAt: billingEvents.occurredAt,
    })
    .from(billingEvents)
    .where(inArray(billingEvents.contractId, ids))
    .orderBy(
      billingEvents.contractId,
      desc(billingEvents.occurredAt),
      desc(billingEvents.receivedAt),
    );
  return {
    prices: groupBy(priceRows, (row) => row.contractId),
    rights: groupBy(rightRows, (row) => row.contractId),
    lastEvents: new Map(eventRows.map((row) => [row.contractId, row])),
  };
}

type PageRelations = Awaited<ReturnType<typeof pageRelations>>;
type PageRow = {
  orgId: string;
  contractId: string;
  offerName: string;
  offerCode: string;
  billingPeriod: string;
  providerSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  lastEventAt: Date | null;
};

function lastEventOf(
  relations: PageRelations,
  contractId: string,
): AdminLastEvent | null {
  const last = relations.lastEvents.get(contractId);
  if (!last) return null;
  return {
    type: last.type,
    outcome: last.outcome,
    occurredAt: last.occurredAt.toISOString(),
  };
}

function toRow(row: PageRow, relations: PageRelations, asOf: Date): AdminSubscriptionRow {
  return {
    orgId: row.orgId,
    contractId: row.contractId,
    offerName: row.offerName,
    offerCode: row.offerCode,
    billingPeriod: row.billingPeriod,
    items: priceItems(relations.prices.get(row.contractId) ?? []),
    providerSubscriptionId: row.providerSubscriptionId,
    status: row.status,
    currentPeriodStart: iso(row.currentPeriodStart),
    currentPeriodEnd: iso(row.currentPeriodEnd),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    lastEvent: lastEventOf(relations, row.contractId),
    divergence: subscriptionDivergence({
      mirror: { status: row.status, lastEventAt: row.lastEventAt },
      entitlements: relations.rights.get(row.contractId) ?? [],
      asOf,
    }),
  };
}

export function listAdminSubscriptions(
  operatorId: string,
  filters: AdminSubscriptionFilters,
): Promise<Paginated<AdminSubscriptionRow>> {
  const { limit, offset } = resolvePageParams(filters);
  const where = filterCondition(filters);
  return withPlatformOperator(operatorId, async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(subs).where(where);
    const page = await tx
      .select({
        orgId: subs.orgId,
        contractId: subs.contractId,
        offerName: contracts.offerName,
        offerCode: contracts.offerCode,
        billingPeriod: contracts.billingPeriod,
        providerSubscriptionId: subs.providerSubscriptionId,
        status: subs.status,
        currentPeriodStart: subs.currentPeriodStart,
        currentPeriodEnd: subs.currentPeriodEnd,
        cancelAtPeriodEnd: subs.cancelAtPeriodEnd,
        lastEventAt: subs.lastEventAt,
      })
      .from(subs)
      .innerJoin(
        contracts,
        and(eq(contracts.id, subs.contractId), eq(contracts.orgId, subs.orgId)),
      )
      .where(where)
      .orderBy(sql`${subs.currentPeriodEnd} desc nulls last`, subs.id)
      .limit(limit)
      .offset(offset);
    if (page.length === 0) return { rows: [], total };
    const relations = await pageRelations(
      tx,
      page.map((row) => row.contractId),
    );
    const asOf = new Date();
    return { total, rows: page.map((row) => toRow(row, relations, asOf)) };
  });
}

export function getAdminSubscription(
  operatorId: string,
  orgId: string,
  contractId: string,
): Promise<AdminSubscriptionDetail> {
  const link = { orgId, contractId };
  return withPlatformOperator(operatorId, async (tx) => {
    const [contract] = await tx
      .select({
        offerName: contracts.offerName,
        offerCode: contracts.offerCode,
        offerVersion: contracts.offerVersion,
        billingPeriod: contracts.billingPeriod,
        currency: contracts.currency,
        fictitious: contracts.fictitious,
        termStart: contracts.termStart,
        termEnd: contracts.termEnd,
      })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, contractId)));
    if (!contract) throw new NotFoundError();
    const priceRows = await tx
      .select({
        contractId: items.contractId,
        position: items.position,
        service: items.service,
        label: items.label,
        unit: items.unit,
        unitAmountCents: items.unitAmountCents,
      })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.contractId, contractId)))
      .orderBy(items.position);
    const mirror = await loadMirror({ tx, link });
    const rightRows = await tx
      .select({
        companyId: rights.companyId,
        service: rights.service,
        status: rights.status,
        reason: rights.reason,
        applied: rights.applied,
        updatedAt: rights.updatedAt,
      })
      .from(rights)
      .where(contractScope(rights, link))
      .orderBy(sql`${rights.companyId} nulls first`, rights.service);
    const eventRows = await tx
      .select({
        type: billingEvents.type,
        outcome: billingEvents.outcome,
        detail: billingEvents.detail,
        occurredAt: billingEvents.occurredAt,
      })
      .from(billingEvents)
      .where(
        and(eq(billingEvents.orgId, orgId), eq(billingEvents.contractId, contractId)),
      )
      .orderBy(desc(billingEvents.occurredAt))
      .limit(10);
    const history = await tx
      .select()
      .from(commercialReconciliations)
      .where(
        and(
          eq(commercialReconciliations.orgId, orgId),
          eq(commercialReconciliations.contractId, contractId),
        ),
      )
      .orderBy(desc(commercialReconciliations.createdAt))
      .limit(20);
    return {
      orgId,
      contractId,
      ...contract,
      items: priceItems(priceRows),
      subscription: mirror && {
        providerSubscriptionId: mirror.providerSubscriptionId,
        providerCustomerId: mirror.providerCustomerId,
        status: mirror.status,
        currentPeriodStart: iso(mirror.currentPeriodStart),
        currentPeriodEnd: iso(mirror.currentPeriodEnd),
        cancelAtPeriodEnd: mirror.cancelAtPeriodEnd,
        canceledAt: iso(mirror.canceledAt),
        lastEventAt: iso(mirror.lastEventAt),
      },
      entitlements: rightRows.map(
        (row): AdminEntitlement => ({ ...row, updatedAt: row.updatedAt.toISOString() }),
      ),
      events: eventRows.map((row) => ({
        ...row,
        occurredAt: row.occurredAt.toISOString(),
      })),
      reconciliations: history.map((row) => ({
        id: row.id,
        operatorId: row.operatorId,
        reason: row.reason,
        result: row.result,
        source: row.source,
        detail: row.detail,
        createdAt: row.createdAt.toISOString(),
      })),
      divergence: subscriptionDivergence({
        mirror,
        entitlements: rightRows,
        asOf: new Date(),
      }),
    };
  });
}

export function findReconcilableContract(
  operatorId: string,
  orgId: string,
  contractId: string,
): Promise<{ providerSubscriptionId: string | null } | null> {
  return withPlatformOperator(operatorId, async (tx) => {
    const [contract] = await tx
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.orgId, orgId), eq(contracts.id, contractId)));
    if (!contract) return null;
    const mirror = await loadMirror({ tx, link: { orgId, contractId } });
    return { providerSubscriptionId: mirror?.providerSubscriptionId ?? null };
  });
}

async function loadState(context: EventContext) {
  const mirror = await loadMirror(context);
  const stored = await context.tx
    .select({
      id: rights.id,
      status: rights.status,
      reason: rights.reason,
    })
    .from(rights)
    .where(contractScope(rights, context.link))
    .orderBy(rights.id);
  return { mirror, stored };
}

type Reapplied = { sourceChecked: boolean; note: string };

function providerEventOf(
  lookup: Extract<SubscriptionLookup, { ok: true }>,
): SubscriptionEvent {
  return {
    kind: "subscription",
    providerEventId: "reconciliation",
    type: "reconciliation",
    occurredAt: new Date(),
    reference: {
      checkoutId: null,
      providerSubscriptionId: lookup.snapshot.providerSubscriptionId,
    },
    snapshot: lookup.snapshot,
  };
}

async function reapplyFromMirror(
  context: EventContext,
  mirror: SubscriptionMirror | null,
): Promise<void> {
  if (mirror) await syncEntitlements(context, mirror, new Date(), null);
}

async function reapply(
  context: EventContext,
  mirror: SubscriptionMirror | null,
  lookup: SubscriptionLookup,
): Promise<Reapplied> {
  if (!lookup.ok || !mirror) {
    await reapplyFromMirror(context, mirror);
    const reason = lookup.ok ? "no_subscription_mirror" : lookup.reason;
    return { sourceChecked: false, note: `provider_unavailable:${reason}` };
  }
  const decision = await mirrorSubscription(context, providerEventOf(lookup));
  if (decision.outcome === "applied")
    return { sourceChecked: true, note: `provider_state_applied:${decision.detail}` };
  await reapplyFromMirror(context, mirror);
  return {
    sourceChecked: true,
    note: `provider_snapshot_${decision.outcome}:${decision.detail}`,
  };
}

export type ReconciliationRequest = {
  operatorId: string;
  orgId: string;
  contractId: string;
  reason: string;
  lookup: SubscriptionLookup;
};

export function applyReconciliation(
  request: ReconciliationRequest,
): Promise<ReconcileOutcome> {
  const link = { orgId: request.orgId, contractId: request.contractId };
  return withOrg(request.orgId, async (tx) => {
    await tx.execute(sql`select set_config('app.current_actor', '', true)`);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`commercial_billing:${request.contractId}`}, 0))`,
    );
    const context: EventContext = { tx, link };
    const before = await loadState(context);
    const applied = await reapply(context, before.mirror, request.lookup);
    const after = await loadState(context);
    const changedRights = entitlementsChangedCount(before.stored, after.stored);
    const mirrorChanged = mirrorFieldsChanged(before.mirror, after.mirror);
    const result = reconciliationResult({
      sourceChecked: applied.sourceChecked,
      changed: mirrorChanged || changedRights > 0,
    });
    const source = applied.sourceChecked ? "provider" : "mirror";
    const detail = `${applied.note};mirror_changed=${mirrorChanged};entitlement_changes=${changedRights}`;
    const [row] = await tx
      .insert(commercialReconciliations)
      .values({
        ...link,
        operatorId: request.operatorId,
        reason: request.reason,
        result,
        detail,
        source,
      })
      .returning({ id: commercialReconciliations.id });
    return { id: row.id, result, source, detail };
  });
}
