import "server-only";

import { randomUUID } from "node:crypto";

import { getRlsBypassingSupabaseClient } from "@/shared/supabase/admin";
import type { NewOrg, Org } from "@/shared/db/schema";

import { stripNullish } from "./_helpers";

export async function upsertOrg(input: NewOrg): Promise<Org> {
  return persistOrg(stripNullish(toOrgColumns(input)));
}

export async function replaceOrg(input: NewOrg): Promise<Org> {
  return persistOrg(toOrgColumns(input));
}

export type CreateTenantInput = {
  id?: string;
  name?: string | null;
  plan?: "free" | "pro";
  clerkOrgId?: string | null;
};

export async function createTenant(input: CreateTenantInput = {}): Promise<Org> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("orgs")
    .insert({
      id: input.id ?? randomUUID(),
      name: input.name ?? null,
      plan: input.plan ?? "free",
      clerk_org_id: input.clerkOrgId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapOrg(data);
}

export async function getOrgById(id: string): Promise<Org | null> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("orgs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrg(data) : null;
}

export async function getOrgByStripeCustomerId(customerId: string): Promise<Org | null> {
  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("orgs")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrg(data) : null;
}

/** Sincroniza o billing do tenant (chamado pelo webhook do Stripe). */
export async function updateOrgBilling(
  orgId: string,
  input: {
    plan?: "free" | "pro";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    trialEndsAt?: Date | null;
  },
): Promise<Org> {
  const columns: Record<string, unknown> = {};
  if (input.plan !== undefined) columns.plan = input.plan;
  if (input.stripeCustomerId !== undefined)
    columns.stripe_customer_id = input.stripeCustomerId;
  if (input.stripeSubscriptionId !== undefined)
    columns.stripe_subscription_id = input.stripeSubscriptionId;
  if (input.trialEndsAt !== undefined)
    columns.trial_ends_at = input.trialEndsAt ? input.trialEndsAt.toISOString() : null;

  const { data, error } = await getRlsBypassingSupabaseClient()
    .from("orgs")
    .update(columns)
    .eq("id", orgId)
    .select("*")
    .single();
  if (error) throw error;
  return mapOrg(data);
}

export async function deleteOrg(id: string): Promise<void> {
  const { error } = await getRlsBypassingSupabaseClient()
    .from("orgs")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

function toOrgColumns(input: NewOrg): Record<string, unknown> {
  const columns: Record<string, unknown> = {
    id: input.id,
    name: input.name ?? null,
    slug: input.slug ?? null,
    image_url: input.imageUrl ?? null,
  };
  if (input.plan !== undefined) columns.plan = input.plan;
  if (input.clerkOrgId !== undefined) columns.clerk_org_id = input.clerkOrgId;
  return columns;
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
    plan: row.plan as string,
    clerkOrgId: (row.clerk_org_id as string | null) ?? null,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
