import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { WebhookEvent } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import {
  OrganizationMembershipPayload,
  toOrgMembershipRow,
  toOrgRow,
  toUserRow,
} from "@/lib/clerk/membership-event-mappers";
import {
  deleteOrgMembership,
  upsertOrgMembership,
} from "@/lib/db/repositories/org-memberships";
import { upsertOrg } from "@/lib/db/repositories/orgs";
import { upsertUser } from "@/lib/db/repositories/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("[clerk-webhook] invalid signature", err);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    return (await dispatch(evt)) ?? new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[clerk-webhook] db error", err);
    return new Response("db error", { status: 500 });
  }
}

async function dispatch(evt: WebhookEvent): Promise<Response | undefined> {
  const supabase = getSupabaseAdminClient();

  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const u = evt.data;
      const primary = u.email_addresses?.find((e) => e.id === u.primary_email_address_id);
      const { error } = await supabase.from("users").upsert(
        {
          id: u.id,
          email: primary?.email_address ?? null,
          first_name: u.first_name ?? null,
          last_name: u.last_name ?? null,
          image_url: u.image_url ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      return;
    }

    case "user.deleted": {
      if (!evt.data.id) return;
      const { error } = await supabase.from("users").delete().eq("id", evt.data.id);
      if (error) throw error;
      return;
    }

    case "organization.created":
    case "organization.updated": {
      const o = evt.data;
      const { error } = await supabase.from("orgs").upsert(
        {
          id: o.id,
          name: o.name,
          slug: o.slug ?? null,
          image_url: o.image_url ?? null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      return;
    }

    case "organization.deleted": {
      if (!evt.data.id) return;
      const { error } = await supabase.from("orgs").delete().eq("id", evt.data.id);
      if (error) throw error;
      return;
    }

    case "organizationMembership.created":
    case "organizationMembership.updated":
      return syncMembership(evt);

    case "organizationMembership.deleted":
      return removeMembership(evt);

    default:
      return;
  }
}

async function syncMembership(evt: WebhookEvent): Promise<Response | undefined> {
  const parsed = OrganizationMembershipPayload.safeParse(evt.data);
  if (!parsed.success) {
    console.error("[clerk-webhook] invalid membership payload", {
      type: evt.type,
      issues: parsed.error.issues,
    });
    return new Response("invalid payload", { status: 400 });
  }
  const payload = parsed.data;
  // Defensive upsert order (users → orgs → memberships) makes the handler
  // tolerant to out-of-order Clerk deliveries: FKs are satisfied even if
  // `user.created`/`organization.created` haven't arrived yet.
  await upsertUser(toUserRow(payload));
  await upsertOrg(toOrgRow(payload));
  await upsertOrgMembership(toOrgMembershipRow(payload));
  console.log("[clerk-webhook] membership sync", {
    type: evt.type,
    org_id: payload.organization.id,
    user_id: payload.public_user_data.user_id,
  });
}

async function removeMembership(evt: WebhookEvent): Promise<Response | undefined> {
  const parsed = OrganizationMembershipPayload.safeParse(evt.data);
  if (!parsed.success) {
    console.error("[clerk-webhook] invalid membership payload", {
      type: evt.type,
      issues: parsed.error.issues,
    });
    return new Response("invalid payload", { status: 400 });
  }
  const payload = parsed.data;
  await deleteOrgMembership({
    orgId: payload.organization.id,
    userId: payload.public_user_data.user_id,
  });
  console.log("[clerk-webhook] membership deleted", {
    org_id: payload.organization.id,
    user_id: payload.public_user_data.user_id,
  });
}
