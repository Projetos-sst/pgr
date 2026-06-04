import { NextResponse } from "next/server";

import { NoActiveOrgError, UnauthorizedError } from "@/lib/auth/errors";
import { requireOrgContext } from "@/lib/auth/require-org-context";
import { NO_STORE_HEADERS } from "@/lib/http/no-store";

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
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new NextResponse(null, { status: 401, headers: NO_STORE_HEADERS });
    }
    if (err instanceof NoActiveOrgError) {
      return NextResponse.json(
        { error: "NO_ACTIVE_ORG" },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }
    return new NextResponse(null, { status: 500, headers: NO_STORE_HEADERS });
  }
}
