import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import type { NewOrgMembership, OrgMembership } from "@/shared/db/schema";

export async function upsertOrgMembership(
  input: NewOrgMembership,
): Promise<OrgMembership> {
  const columns: Record<string, unknown> = {
    org_id: input.orgId,
    user_id: input.userId,
    role: input.role,
  };
  if (input.scopedCompanyId !== undefined) {
    columns.scoped_company_id = input.scopedCompanyId;
  }

  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("org_memberships")
    .upsert(columns, { onConflict: "org_id,user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return mapMembership(data);
}

export async function ensureOwnerMembership(args: {
  orgId: string;
  userId: string;
}): Promise<OrgMembership> {
  return upsertOrgMembership({ orgId: args.orgId, userId: args.userId, role: "owner" });
}

export type TenantMembershipRow = {
  orgId: string;
  role: string;
  scopedCompanyId: string | null;
  plan: string;
  clerkOrgId: string | null;
};

export async function listTenantMembershipsByUser(
  userId: string,
): Promise<TenantMembershipRow[]> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("org_memberships")
    .select("org_id, role, scoped_company_id, orgs!inner(plan, clerk_org_id)")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map(mapTenantMembershipRow);
}

export async function deleteOrgMembership(args: {
  orgId: string;
  userId: string;
}): Promise<void> {
  const { error } = await getRlsBypassingSupabaseClient()
    .from("org_memberships")
    .delete()
    .match({ org_id: args.orgId, user_id: args.userId });
  if (error) throw error;
}

function mapMembership(row: Record<string, unknown>): OrgMembership {
  return {
    orgId: row.org_id as string,
    userId: row.user_id as string,
    role: row.role as string,
    scopedCompanyId: (row.scoped_company_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapTenantMembershipRow(row: Record<string, unknown>): TenantMembershipRow {
  const org = normalizeEmbeddedOrg(row.orgs);
  return {
    orgId: row.org_id as string,
    role: row.role as string,
    scopedCompanyId: (row.scoped_company_id as string | null) ?? null,
    plan: (org?.plan as string) ?? "free",
    clerkOrgId: (org?.clerk_org_id as string | null) ?? null,
  };
}

function normalizeEmbeddedOrg(embedded: unknown): Record<string, unknown> | null {
  if (Array.isArray(embedded)) return (embedded[0] as Record<string, unknown>) ?? null;
  return (embedded as Record<string, unknown> | null) ?? null;
}
