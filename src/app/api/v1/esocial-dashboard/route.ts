import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import * as repo from "@/shared/db/repositories/esocial-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Painel agregado do eSocial (#218) — somente leitura, tudo derivado de
// `esocial_events` (KPIs, contagem por tipo e eventos recentes).
export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => repo.getEsocialDashboard(tenantId));
}
