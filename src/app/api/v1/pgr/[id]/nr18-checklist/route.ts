import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { buildNr18Checklist } from "@/shared/domains/documents/nr18";
import { listPgrNr18Documents } from "@/shared/db/repositories/documents";
import { getPgrById } from "@/shared/db/repositories/pgr";
import { NotFoundError } from "@/shared/errors/not-found-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Checklist informativo dos documentos complementares da NR-18 (#48). Leitura pura,
 * derivada dos anexos que o GED já tem — não bloqueia nada e não cria tipo novo.
 */
export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const pgr = await getPgrById(tenantId, id);
    if (!pgr) throw new NotFoundError();
    return buildNr18Checklist(await listPgrNr18Documents(tenantId, id));
  });
}
