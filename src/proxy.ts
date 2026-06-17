import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { NO_STORE_HEADERS } from "@/shared/http/no-store";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
]);

const NO_STORE_PATH_PREFIXES = ["/api/", "/sign-in", "/sign-up", "/dashboard"];

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

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
