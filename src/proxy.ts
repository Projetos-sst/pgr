import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { NO_STORE_HEADERS } from "@/shared/http/no-store";

// Bypass dev da REST API: libera /api/v1 sem sessao Clerk APENAS fora de producao
// e com flag explicita. Em producao (APP_ENV=production) nunca e publico.
const devApiBypass =
  process.env.APP_ENV !== "production" && process.env.DEV_API_AUTH_BYPASS === "true";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Assinatura publica de entrega de EPI: a credencial e o proprio token HMAC
  // (verificado na rota), nao a sessao Clerk.
  "/sign/(.*)",
  // Assinatura publica generica (fatia 010 + PGR na 022): a credencial e o token
  // (resolvido pela policy de capability), nao a sessao Clerk.
  "/assinar/(.*)",
  // Questionario psicossocial publico e anonimo (fatia 041): credencial = token
  // da campanha (policy de capability), nunca sessao Clerk.
  "/responderpsico/(.*)",
  "/api/webhooks/(.*)",
  ...(devApiBypass ? ["/api/v1/(.*)"] : []),
]);

// "/sign/" e "/assinar/" cobrem as rotas publicas de assinatura (nunca cachear o estado).
const NO_STORE_PATH_PREFIXES = [
  "/api/",
  "/sign-in",
  "/sign-up",
  "/sign/",
  "/assinar/",
  "/responderpsico/",
  "/dashboard",
];

export default clerkMiddleware(async (auth, request) => {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  if (!isPublicRoute(request)) {
    await auth.protect();
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
