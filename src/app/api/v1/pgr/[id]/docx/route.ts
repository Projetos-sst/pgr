import { NextResponse, type NextRequest } from "next/server";

import { resolveContext, restStatusForCode } from "@/shared/api/rest";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  pgrDocxFormatSchema,
  pgrDocxRequestSchema,
} from "@/shared/domains/pgr/pgr-docx/request";
import { toActionError } from "@/shared/server/action-error";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import {
  generatePgrDocx,
  type GeneratePgrDocxOptions,
} from "@/shared/server/platform/pgr-docx-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PGR gerado pelo template DOCX (`templates/pgr/pgr-template.docx`). Binário, por isso
 * não usa `restHandler` — mas reusa o MESMO gate (`resolveContext`, honra o dev bypass)
 * e o MESMO mapa de status (`restStatusForCode`), como a rota `/pdf`.
 *
 * - `GET ?format=docx|pdf` — semi-fixos com os valores padrão;
 * - `POST {format, overrides}` — semi-fixos alterados (labels/títulos/textos/campanhas),
 *   validados por `pgrDocxRequestSchema` (chave desconhecida → 422).
 */
async function respond(
  req: NextRequest,
  { params }: Ctx,
  read: () => Promise<GeneratePgrDocxOptions>,
) {
  let ctx: TenantContext | null = null;
  try {
    ctx = await resolveContext(req);
    const { id } = await params;
    const options = await read();
    const { fileName, contentType, file, missingTags } = await generatePgrDocx(
      ctx.tenantId,
      id,
      options,
    );
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Pgr-Docx-Missing-Tags": String(missingTags.length),
      },
    });
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) {
      return NextResponse.json(
        { error: mapped },
        { status: restStatusForCode(mapped.code) },
      );
    }
    logTenantEvent("error", {
      operation: `api.v1 ${req.method} pgr.docx`,
      outcome: "rejected",
      orgId: ctx?.tenantId ?? null,
      userId: ctx?.userId ?? null,
    });
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Erro inesperado." } },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return respond(req, ctx, async () => ({
    format: pgrDocxFormatSchema.parse(req.nextUrl.searchParams.get("format") ?? "docx"),
  }));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return respond(req, ctx, async () => {
    // Corpo ausente ou JSON inválido → `null` → 422 pelo schema (nunca 500).
    const body: unknown = await req.json().catch(() => null);
    return pgrDocxRequestSchema.parse(body);
  });
}
