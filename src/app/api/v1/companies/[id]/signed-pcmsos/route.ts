import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import {
  listSignedPcmsos,
  registerSignedPcmso,
  signedPcmsoFields,
} from "@/shared/server/medicine/pcmso-signed-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

// PCMSOs assinados da empresa, o vigente e alertas de desatualização (NOB-166).
export function GET(req: NextRequest, context: Context) {
  return restHandler(req, async (ctx) =>
    listSignedPcmsos(ctx, (await context.params).id),
  );
}

// Multipart: `file` (PDF assinado) + origin, previewDocumentId, signatureMethod,
// verificationReference, signerName, signerRegistration, signerUf, signedOn,
// replacesId?, changeKind?, replaceReason?.
export function POST(req: NextRequest, context: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const form = await req.formData();
      const raw = form.get("file");
      return registerSignedPcmso(
        ctx,
        (await context.params).id,
        signedPcmsoFields(form),
        raw instanceof File ? raw : null,
      );
    },
    { status: 201 },
  );
}
