import { NextResponse, type NextRequest } from "next/server";

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { getTenantSwitcher } from "@/shared/tenant/switcher";
import { toActionError } from "@/shared/server/action-error";
import { generateReport } from "@/shared/server/platform/reports-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ type: string }> };

/**
 * Gera e baixa o relatório em PDF. Não usa `restHandler` porque a resposta de
 * sucesso é binária (application/pdf), não JSON; erros conhecidos ainda voltam
 * como JSON com o status mapeado.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const ctx = await requireOfficeStaff();
    const { type } = await params;
    const switcher = await getTenantSwitcher();
    const orgName =
      switcher?.options.find((o) => o.isActive)?.name ?? "Minha organização";
    const { fileName, pdf } = await generateReport(ctx.tenantId, orgName, type);
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
      const status =
        mapped.code === "REPORT_UNAVAILABLE"
          ? 503
          : mapped.code === "NOT_FOUND"
            ? 404
            : mapped.code === "FORBIDDEN"
              ? 403
              : 400;
      return NextResponse.json({ error: mapped }, { status });
    }
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Erro inesperado." } },
      { status: 500 },
    );
  }
}
