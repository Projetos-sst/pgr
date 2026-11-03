import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import {
  actOnInvitation,
  type InvitationAction,
} from "@/shared/server/medicine/professional-links-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = {
  params: Promise<{ id: string; invitationId: string; action: string }>;
};

const ACTIONS = new Set<InvitationAction>([
  "accept",
  "approve",
  "decline",
  "cancel",
  "complete",
]);

// accept/decline: só a conta convidada · approve: outro owner, no autovínculo · cancel: owner ·
// complete: autovínculo concluído pela própria conta com identidade verificada (NOB-160).
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const { id, invitationId, action } = await context.params;
      if (!ACTIONS.has(action as InvitationAction)) throw new NotFoundError();
      return actOnInvitation(ctx, id, invitationId, action as InvitationAction);
    },
    { tenantAccess: true },
  );
}
