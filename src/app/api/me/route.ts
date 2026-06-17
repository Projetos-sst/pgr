import { NextResponse } from "next/server";

import { requireOrgContext } from "@/shared/auth/require-org-context";
import { AppError } from "@/shared/errors/app-error";
import { NO_STORE_HEADERS } from "@/shared/http/no-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  try {
    const ctx = await requireOrgContext();
    return NextResponse.json(
      { userId: ctx.userId, orgId: ctx.orgId },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (!(error instanceof AppError)) {
    return new NextResponse(null, { status: 500, headers: NO_STORE_HEADERS });
  }
  if (error.status === 401) {
    return new NextResponse(null, { status: 401, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json(
    { error: error.code },
    { status: error.status, headers: NO_STORE_HEADERS },
  );
}
