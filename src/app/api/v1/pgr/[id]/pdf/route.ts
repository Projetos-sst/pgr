import { NextResponse, type NextRequest } from "next/server";

import { resolveContext, restStatusForCode } from "@/shared/api/rest";
import { toActionError } from "@/shared/server/action-error";
import { generatePgrPdf } from "@/shared/server/platform/pgr-pdf-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Gera e baixa o PDF do PGR (fatia #40). Binário (application/pdf), por isso não
 * usa `restHandler`; mas reusa o MESMO gate de auth (`resolveContext` — honra o
 * dev bypass) e o MESMO mapa de status (`restStatusForCode`) do `restHandler`.
 * Erros conhecidos voltam como JSON com o status mapeado. Cor da capa opcional
 * via `?color=` (default no template).
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const ctx = await resolveContext(req);
    const { id } = await params;
    const color = req.nextUrl.searchParams.get("color") ?? undefined;

    const { fileName, pdf } = await generatePgrPdf(ctx.tenantId, id, {
      coverColor: color,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
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
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Erro inesperado." } },
      { status: 500 },
    );
  }
}
