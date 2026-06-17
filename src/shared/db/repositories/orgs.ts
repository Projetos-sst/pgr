import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import type { NewOrg, Org } from "@/shared/db/schema";

import { stripNullish } from "./_helpers";

export async function upsertOrg(input: NewOrg): Promise<Org> {
  return persistOrg(stripNullish(toOrgColumns(input)));
}

export async function replaceOrg(input: NewOrg): Promise<Org> {
  return persistOrg(toOrgColumns(input));
}

export async function deleteOrg(id: string): Promise<void> {
  const { error } = await getRlsBypassingSupabaseClient()
    .from("orgs")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

function toOrgColumns(input: NewOrg): Record<string, unknown> {
  return {
    id: input.id,
    name: input.name ?? null,
    slug: input.slug ?? null,
    image_url: input.imageUrl ?? null,
  };
}

async function persistOrg(columns: Record<string, unknown>): Promise<Org> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("orgs")
    .upsert(columns, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return mapOrg(data);
}

function mapOrg(row: Record<string, unknown>): Org {
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    slug: (row.slug as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
