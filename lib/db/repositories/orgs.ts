import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NewOrg, Org } from "@/lib/db/schema";

import { stripNullish } from "./_helpers";

export async function upsertOrg(input: NewOrg): Promise<Org> {
  const row = stripNullish({
    id: input.id,
    name: input.name ?? null,
    slug: input.slug ?? null,
    image_url: input.imageUrl ?? null,
  });

  const { data, error } = await getSupabaseAdminClient()
    .from("orgs")
    .upsert(row, { onConflict: "id" })
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
