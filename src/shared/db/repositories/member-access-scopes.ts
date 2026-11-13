import "server-only";

import { and, asc, eq, sql, type SQL } from "drizzle-orm";

import type {
  AccessScopeGrant,
  AccessScopeView,
} from "@/shared/domains/platform/access-scopes";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { toDomainRole } from "@/shared/tenant/roles";

import { companies } from "../schema/companies";
import { memberAccessScopes } from "../schema/member-access-scopes";
import { orgMemberships } from "../schema/org-memberships";
import { workUnits } from "../schema/work-units";
import { withOrg, type TenantTransaction } from "../with-org";
import { auditedTenantWrite } from "./audited-write";

const WRITE_REJECTED = "platform.access_scopes.write_rejected";

function scopeViews(
  tx: TenantTransaction,
  where: SQL | undefined,
): Promise<AccessScopeView[]> {
  return tx
    .select({
      id: memberAccessScopes.id,
      userId: memberAccessScopes.userId,
      companyId: memberAccessScopes.companyId,
      companyName: companies.razaoSocial,
      workUnitId: memberAccessScopes.workUnitId,
      workUnitName: workUnits.name,
      area: memberAccessScopes.area,
      grantedBy: memberAccessScopes.grantedBy,
      grantedAt: memberAccessScopes.grantedAt,
    })
    .from(memberAccessScopes)
    .innerJoin(companies, eq(companies.id, memberAccessScopes.companyId))
    .leftJoin(workUnits, eq(workUnits.id, memberAccessScopes.workUnitId))
    .where(where)
    .orderBy(
      asc(companies.razaoSocial),
      asc(workUnits.name),
      asc(memberAccessScopes.area),
    );
}

function ofMember(orgId: string, userId: string): SQL | undefined {
  return and(eq(memberAccessScopes.orgId, orgId), eq(memberAccessScopes.userId, userId));
}

async function assertRestrictableMember(
  tx: TenantTransaction,
  orgId: string,
  userId: string,
): Promise<void> {
  const [member] = await tx
    .select({ role: orgMemberships.role })
    .from(orgMemberships)
    .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId)))
    .limit(1);
  if (!member) throw new NotFoundError();
  if (toDomainRole(member.role) === "owner")
    throw new ValidationError(
      "O administrador tem acesso completo e não recebe restrição de escopo.",
    );
}

export async function listMemberAccessScopes(
  orgId: string,
  userId: string,
): Promise<AccessScopeView[]> {
  return withOrg(orgId, (tx) => scopeViews(tx, ofMember(orgId, userId)));
}

export async function grantMemberAccessScope(
  orgId: string,
  actor: string,
  userId: string,
  grant: AccessScopeGrant,
): Promise<AccessScopeView> {
  return auditedTenantWrite(orgId, WRITE_REJECTED, () =>
    withOrg(orgId, async (tx) => {
      await tx.execute(sql`select set_config('app.current_actor', ${actor}, true)`);
      await assertRestrictableMember(tx, orgId, userId);
      const [created] = await tx
        .insert(memberAccessScopes)
        .values({
          orgId,
          userId,
          companyId: grant.companyId,
          workUnitId: grant.workUnitId ?? null,
          area: grant.area,
          grantedBy: actor,
        })
        .returning({ id: memberAccessScopes.id });
      const [view] = await scopeViews(tx, eq(memberAccessScopes.id, created.id));
      return view;
    }),
  );
}

export async function revokeMemberAccessScope(
  orgId: string,
  actor: string,
  userId: string,
  scopeId: string,
): Promise<void> {
  return auditedTenantWrite(orgId, WRITE_REJECTED, () =>
    withOrg(orgId, async (tx) => {
      await tx.execute(sql`select set_config('app.current_actor', ${actor}, true)`);
      const removed = await tx
        .delete(memberAccessScopes)
        .where(and(ofMember(orgId, userId), eq(memberAccessScopes.id, scopeId)))
        .returning({ id: memberAccessScopes.id });
      if (removed.length === 0) throw new NotFoundError();
    }),
  );
}
