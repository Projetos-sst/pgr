import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import {
  asoDeliveryFields,
  listDeliveries,
  registerDelivery,
} from "@/shared/server/medicine/aso-delivery-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// Entregas do ASO do exame e a situação do ASO vigente (NOB-165).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listDeliveries(ctx, (await context.params).id));
}

// Multipart: kind (made_available | physical_copy_requested), method?, channelDescription?,
// occurredAt (AAAA-MM-DDTHH:mm, horário de Brasília), evidenceReference?, evidenceKind?, evidence?.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const form = await req.formData();
      const raw = form.get("evidence");
      return registerDelivery(
        ctx,
        (await context.params).id,
        asoDeliveryFields(form),
        raw instanceof File ? raw : null,
      );
    },
    { status: 201 },
  );
}
