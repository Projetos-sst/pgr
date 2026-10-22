import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { machineOptions } from "@/shared/server/pgr/machine-installation-core";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return restHandler(req, (ctx) => machineOptions(ctx, id));
}
