import { NextResponse } from "next/server";

import { NoActiveOrgError, UnauthorizedError } from "@/lib/auth/errors";
import { requireOrgContext } from "@/lib/auth/require-org-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export async function GET() {
  try {
    const ctx = await requireOrgContext();
    return NextResponse.json(
      { userId: ctx.userId, orgId: ctx.orgId },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new NextResponse(null, { status: 401, headers: NO_STORE });
    }
    if (err instanceof NoActiveOrgError) {
      return NextResponse.json(
        { error: "NO_ACTIVE_ORG" },
        { status: 403, headers: NO_STORE },
      );
    }
    return new NextResponse(null, { status: 500, headers: NO_STORE });
  }
}
