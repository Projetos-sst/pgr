import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

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

  const supabase = getSupabaseAdminClient();

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const u = evt.data;
        const primary = u.email_addresses?.find(
          (e) => e.id === u.primary_email_address_id,
        );
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
        break;
      }

      case "user.deleted": {
        if (!evt.data.id) break;
        const { error } = await supabase
          .from("users")
          .delete()
          .eq("id", evt.data.id);
        if (error) throw error;
        break;
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
        break;
      }

      case "organization.deleted": {
        if (!evt.data.id) break;
        const { error } = await supabase
          .from("orgs")
          .delete()
          .eq("id", evt.data.id);
        if (error) throw error;
        break;
      }

      default:
        // Outros eventos (sessions, memberships, billing, etc.) ignorados.
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[clerk-webhook] db error", err);
    // 500 => Clerk reentrega o evento.
    return new Response("db error", { status: 500 });
  }
}
