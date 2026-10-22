import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  listMachines,
  createMachine,
} from "@/shared/server/pgr/machine-installation-core";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  const { id } = await params;
  return restHandler(req, (ctx) =>
    listMachines(ctx, id, {
      page: Number(req.nextUrl.searchParams.get("page")),
      pageSize: Number(req.nextUrl.searchParams.get("pageSize")),
      includeInactive: req.nextUrl.searchParams.get("includeInactive") === "true",
    }),
  );
}
export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params;
  return restHandler(
    req,
    async (ctx) => createMachine(ctx, id, await readJsonBody(req)),
    { status: 201 },
  );
}
