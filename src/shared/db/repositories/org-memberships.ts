import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import type { NewOrgMembership, OrgMembership } from "@/shared/db/schema";
import { toDomainRole } from "@/shared/tenant/roles";

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
  name: string | null;
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
    .select("org_id, role, scoped_company_id, orgs!inner(name, plan, clerk_org_id)")
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

export type TeamMemberRow = {
  userId: string;
  role: string;
  scopedCompanyId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  jobTitle: string | null;
};

/**
 * Team roster for a tenant. `org_memberships` bypasses RLS, so the `org_id`
 * filter is the isolation boundary — `orgId` MUST come from the session tenant,
 * never from client input. Search + pagination are applied in-app (teams are
 * small, bounded per organization).
 */
export async function listMembershipsByOrg(
  orgId: string,
  params: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{ rows: TeamMemberRow[]; total: number }> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("org_memberships")
    .select(
      "user_id, role, scoped_company_id, users!inner(email, first_name, last_name, image_url, job_title)",
    )
    .eq("org_id", orgId);
  if (error) throw error;

  let members = (data ?? []).map(mapTeamMemberRow);

  const search = params.search?.trim().toLowerCase();
  if (search) {
    members = members.filter((m) =>
      [m.firstName, m.lastName, m.email, m.jobTitle]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(search)),
    );
  }

  const total = members.length;
  const pageSize = params.pageSize ?? 20;
  const page = params.page ?? 1;
  const start = (page - 1) * pageSize;
  return { rows: members.slice(start, start + pageSize), total };
}

export async function getOrgMembership(args: {
  orgId: string;
  userId: string;
}): Promise<OrgMembership | null> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("org_memberships")
    .select("*")
    .match({ org_id: args.orgId, user_id: args.userId })
    .maybeSingle();
  if (error) throw error;
  return data ? mapMembership(data) : null;
}

export async function updateMembershipRole(args: {
  orgId: string;
  userId: string;
  role: string;
}): Promise<OrgMembership> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("org_memberships")
    .update({ role: args.role })
    .match({ org_id: args.orgId, user_id: args.userId })
    .select("*")
    .single();
  if (error) throw error;
  return mapMembership(data);
}

/**
 * Conta administradores (papel normalizado `owner`) da org. `role` cru varia por
 * origem — `owner` literal no tenant pessoal, `org:admin` em orgs Clerk-backed —
 * então a contagem é feita em app (bounded por tenant, igual à busca/paginação de
 * `listMembershipsByOrg`), não via filtro de igualdade no banco.
 */
export async function countOwnersByOrg(orgId: string): Promise<number> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId);
  if (error) throw error;
  return (data ?? []).filter((row) => toDomainRole(row.role as string) === "owner")
    .length;
}

function mapTeamMemberRow(row: Record<string, unknown>): TeamMemberRow {
  const user = normalizeEmbeddedOrg(row.users);
  return {
    userId: row.user_id as string,
    role: row.role as string,
    scopedCompanyId: (row.scoped_company_id as string | null) ?? null,
    email: (user?.email as string | null) ?? null,
    firstName: (user?.first_name as string | null) ?? null,
    lastName: (user?.last_name as string | null) ?? null,
    imageUrl: (user?.image_url as string | null) ?? null,
    jobTitle: (user?.job_title as string | null) ?? null,
  };
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
    name: (org?.name as string | null) ?? null,
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
