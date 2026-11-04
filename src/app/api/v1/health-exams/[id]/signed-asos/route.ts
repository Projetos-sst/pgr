import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import {
  listSignedAsos,
  registerSignedAso,
  signedAsoFields,
} from "@/shared/server/medicine/aso-signed-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// ASOs assinados do exame, com a cadeia de substituição (NOB-163).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) => listSignedAsos(ctx, (await context.params).id));
}

// Registro multipart: `file` (PDF assinado) + origin, previewDocumentId?, signatureMethod,
// verificationReference, signerName, signerRegistration, signerUf, conclusion, signedOn,
// replacesId?, replaceReason?.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const form = await req.formData();
      const raw = form.get("file");
      return registerSignedAso(
        ctx,
        (await context.params).id,
        signedAsoFields(form),
        raw instanceof File ? raw : null,
      );
    },
    { status: 201 },
  );
}
