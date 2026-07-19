import type { NextRequest } from "next/server";

import { restHandler } from "@/shared/api/rest";
import { createFolderSchema } from "@/shared/domains/documents/folders";
import { listFolderTree, createFolder } from "@/shared/db/repositories/folders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parentIdFrom(req: NextRequest): string | null {
  const raw = req.nextUrl.searchParams.get("parentId");
  return raw && raw !== "" ? raw : null;
}

/** GET /folders — pastas filhas diretas da pasta (`?parentId=`, raiz = ausente) + breadcrumb. */
export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) => listFolderTree(tenantId, parentIdFrom(req)));
}

/** POST /folders — cria pasta (pai opcional; unicidade de irmã → 409). */
export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const values = createFolderSchema.parse(await req.json());
      return createFolder(tenantId, values);
    },
    { status: 201 },
  );
}
