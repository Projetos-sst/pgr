import type { NextRequest } from "next/server";

import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { categoryInputSchema, type CategoryType } from "@/shared/domains/pgr/categories";
import * as repo from "@/shared/db/repositories/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function typeFrom(req: NextRequest): CategoryType | undefined {
  const value = req.nextUrl.searchParams.get("type");
  return value === "epi" || value === "machine" || value === "supply" ? value : undefined;
}

function isActiveFrom(req: NextRequest): boolean | undefined {
  const value = req.nextUrl.searchParams.get("isActive");
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listCategories(tenantId, {
      ...pageParamsFrom(req),
      search: req.nextUrl.searchParams.get("search") ?? undefined,
      type: typeFrom(req),
      isActive: isActiveFrom(req),
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const input = categoryInputSchema.parse(await req.json());
      return repo.createCategory(tenantId, input);
    },
    { status: 201 },
  );
}
