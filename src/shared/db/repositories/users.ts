import "server-only";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import type { NewUser, User } from "@/shared/db/schema";

import { stripNullish } from "./_helpers";

export async function upsertUser(input: NewUser): Promise<User> {
  return persistUser(stripNullish(toUserColumns(input)));
}

export async function replaceUser(input: NewUser): Promise<User> {
  return persistUser(toUserColumns(input));
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

function toUserColumns(input: NewUser): Record<string, unknown> {
  return {
    id: input.id,
    email: input.email ?? null,
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    image_url: input.imageUrl ?? null,
  };
}

async function persistUser(columns: Record<string, unknown>): Promise<User> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .upsert(columns, { onConflict: "id" })
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
