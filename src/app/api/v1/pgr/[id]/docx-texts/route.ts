import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { readJsonBody } from "@/shared/api/read-json-body";
import {
  listPgrDocxTextVersions,
  savePgrDocxTextVersion,
} from "@/shared/server/pgr/pgr-docx-texts-core";

type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Context) {
  return restHandler(req, async (ctx) =>
    listPgrDocxTextVersions(ctx, (await params).id, pageParamsFrom(req)),
  );
}

export function POST(req: NextRequest, { params }: Context) {
  return restHandler(
    req,
    async (ctx) => {
      const row = await savePgrDocxTextVersion(
        ctx,
        (await params).id,
        await readJsonBody(req),
      );
      return { id: row.id, version: row.version, textsSha256: row.textsSha256 };
    },
    { status: 201 },
  );
}
