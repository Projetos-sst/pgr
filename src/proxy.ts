import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { NO_STORE_HEADERS } from "@/shared/http/no-store";
import { ACTIVE_ORG_COOKIE, reconcileActiveOrg } from "@/shared/tenant/org-switch";

// Bypass dev da REST API: libera /api/v1 sem sessao Clerk APENAS fora de producao
// e com flag explicita. Em producao (APP_ENV=production) nunca e publico.
const devApiBypass =
  process.env.APP_ENV !== "production" && process.env.DEV_API_AUTH_BYPASS === "true";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  ...(devApiBypass ? ["/api/v1/(.*)"] : []),
]);

const NO_STORE_PATH_PREFIXES = ["/api/", "/sign-in", "/sign-up", "/dashboard"];

export default clerkMiddleware(async (auth, request) => {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  if (!isPublicRoute(request)) {
    await auth.protect();

    const { orgId, userId } = await auth();
    const lastSeenOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value ?? null;
    const { nextCookieValue } = reconcileActiveOrg({
      activeOrgId: orgId ?? null,
      lastSeenOrgId,
      userId: userId ?? null,
    });

    if (nextCookieValue === null) {
      response.cookies.delete(ACTIVE_ORG_COOKIE);
    } else if (nextCookieValue !== lastSeenOrgId) {
      response.cookies.set(ACTIVE_ORG_COOKIE, nextCookieValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
      });
    }
  }

  if (NO_STORE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
      response.headers.set(name, value);
    }
  }

  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map|webmanifest)$).*)",
    "/(api|trpc)(.*)",
  ],
};
