import "server-only";

import { getRlsBypassingSupabaseClient } from "@/lib/supabase/admin";
import type { NewOrgMembership, OrgMembership } from "@/lib/db/schema";

export async function upsertOrgMembership(
  input: NewOrgMembership,
): Promise<OrgMembership> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("org_memberships")
    .upsert(
      { org_id: input.orgId, user_id: input.userId, role: input.role },
      { onConflict: "org_id,user_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return mapMembership(data);
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
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
