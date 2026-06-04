import "server-only";

import { getRlsBypassingSupabaseClient } from "@/lib/supabase/admin";
import type { NewUser, User } from "@/lib/db/schema";

import { stripNullish } from "./_helpers";

export async function upsertUser(input: NewUser): Promise<User> {
  const row = stripNullish({
    id: input.id,
    email: input.email ?? null,
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    image_url: input.imageUrl ?? null,
  });

  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return mapUser(data);
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: (row.email as string | null) ?? null,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
