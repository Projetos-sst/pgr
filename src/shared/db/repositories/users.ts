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

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapUser(data) : null;
}

/**
 * App-managed profile update (self-service). Only touches the app-managed
 * columns (phone/cpf/job_title) — name/email/avatar stay Clerk-owned so the
 * Clerk webhook sync never clobbers user edits. No external dependency, so this
 * is exercised end-to-end against the ephemeral Postgres.
 */
export async function updateUserProfile(
  id: string,
  input: {
    phone: string | null;
    cpf: string | null;
    jobTitle: string | null;
  },
): Promise<User> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("users")
    .update({
      phone: input.phone,
      cpf: input.cpf,
      job_title: input.jobTitle,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapUser(data);
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
    phone: (row.phone as string | null) ?? null,
    cpf: (row.cpf as string | null) ?? null,
    jobTitle: (row.job_title as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
