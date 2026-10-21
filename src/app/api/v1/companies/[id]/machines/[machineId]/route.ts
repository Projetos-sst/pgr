import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  getMachine,
  updateMachine,
  archiveMachine,
} from "@/shared/server/pgr/machine-installation-core";
type Context = { params: Promise<{ id: string; machineId: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  const { id, machineId } = await params;
  return restHandler(req, (ctx) =>
    getMachine(ctx, id, machineId, {
      page: Number(req.nextUrl.searchParams.get("page")),
      pageSize: Number(req.nextUrl.searchParams.get("pageSize")),
    }),
  );
}
export async function PUT(req: NextRequest, { params }: Context) {
  const { id, machineId } = await params;
  return restHandler(req, async (ctx) =>
    updateMachine(ctx, id, machineId, await readJsonBody(req)),
  );
}
export async function DELETE(req: NextRequest, { params }: Context) {
  const { id, machineId } = await params;
  return restHandler(
    req,
    async (ctx) => {
      await archiveMachine(ctx, id, machineId, await readJsonBody(req));
      return null;
    },
    { status: 204 },
  );
}
