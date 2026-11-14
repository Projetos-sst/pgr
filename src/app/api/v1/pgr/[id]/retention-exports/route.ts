import { NextResponse, type NextRequest } from "next/server";

import { pageParamsFrom, restHandler } from "@/shared/api/rest";
import {
  exportPgrRetentionPackage,
  listPgrRetentionExports,
} from "@/shared/server/retention/retention-export-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Context) {
  return restHandler(req, async (ctx) =>
    listPgrRetentionExports(ctx, (await params).id, pageParamsFrom(req)),
  );
}

export function POST(req: NextRequest, { params }: Context) {
  return restHandler(req, async (ctx) => {
    const { file, fileName, manifest, exportId } = await exportPgrRetentionPackage(
      ctx,
      (await params).id,
    );
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Retention-Export-Id": exportId,
        "X-Retention-Export-Status": manifest.status,
        "X-Retention-Export-Sha256": manifest.contentSha256,
      },
    });
  });
}
