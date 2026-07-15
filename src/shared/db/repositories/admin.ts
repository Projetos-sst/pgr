import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import type { MasterUser, OrgAiUsage } from "@/shared/domains/platform/admin";

/**
 * Repositório da área de superadmin (/admin-global). Opera CROSS-TENANT por
 * natureza (ex.: uso de IA por organização) — acesso restrito a `is_master`
 * (guard `requireMaster`). Usa o service client (bypassa RLS), como as demais
 * tabelas de identidade.
 */

function fullName(
  first: string | null,
  last: string | null,
  email: string | null,
): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email || "Sem nome";
}

export async function isUserMaster(userId: string): Promise<boolean> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .select("is_master")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.is_master === true;
}

export async function listMasters(): Promise<MasterUser[]> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .select("id, email, first_name, last_name")
    .eq("is_master", true);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    email: (r.email as string | null) ?? null,
    name: fullName(
      r.first_name as string | null,
      r.last_name as string | null,
      r.email as string | null,
    ),
  }));
}

export async function countMasters(): Promise<number> {
  const { count, error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("is_master", true);
  if (error) throw error;
  return count ?? 0;
}

export async function setUserMaster(userId: string, isMaster: boolean): Promise<void> {
  const { error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .update({ is_master: isMaster })
    .eq("id", userId);
  if (error) throw error;
}

export async function findUserByEmail(email: string): Promise<MasterUser | null> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .select("id, email, first_name, last_name")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    email: (data.email as string | null) ?? null,
    name: fullName(
      data.first_name as string | null,
      data.last_name as string | null,
      data.email as string | null,
    ),
  };
}

/**
 * Uso de IA (Anthropic) por organização — agregação CROSS-TENANT (master-only).
 * `ai_usage_events` é append-only e modesto; conta-se em memória e junta-se o nome
 * da org. Ordenado por volume desc.
 */
export async function aiUsageByOrg(): Promise<OrgAiUsage[]> {
  const client = getRlsBypassingSupabaseClient();
  const { data: events, error } = await client.from("ai_usage_events").select("org_id");
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const e of events ?? []) {
    const orgId = e.org_id as string;
    counts.set(orgId, (counts.get(orgId) ?? 0) + 1);
  }
  const orgIds = [...counts.keys()];
  if (orgIds.length === 0) return [];

  const { data: orgs, error: orgErr } = await client
    .from("orgs")
    .select("id, name")
    .in("id", orgIds);
  if (orgErr) throw orgErr;
  const nameById = new Map(
    (orgs ?? []).map((o) => [o.id as string, o.name as string | null]),
  );

  return orgIds
    .map((orgId) => ({
      orgId,
      orgName: nameById.get(orgId) ?? null,
      count: counts.get(orgId) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}
