import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { isDevAuthBypassEnabled } from "@/shared/api/dev-bypass";
import { NO_STORE_HEADERS } from "@/shared/http/no-store";

// Bypass dev da REST API: libera /api/v1 sem sessao Clerk APENAS com APP_ENV definido,
// diferente de producao, e com flag explicita. APP_ENV ausente/vazio ou "production"
// nunca e publico (predicado unico em `shared/api/dev-bypass.ts`).
const devApiBypass = isDevAuthBypassEnabled();

// Basic auth de sandbox: quando APP_ENV=sandbox, protege o ambiente inteiro (antes
// de qualquer logica do Clerk) com um prompt HTTP Basic nativo do navegador, para
// evitar indexacao/acesso publico de um ambiente que ainda nao e producao. Nunca
// entra em producao (kill-switch e o proprio valor de APP_ENV).
const SANDBOX_BASIC_AUTH_REALM = "Sandbox";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function checkSandboxBasicAuth(request: NextRequest): NextResponse | null {
  if (process.env.APP_ENV !== "sandbox") return null;
  // Webhooks sao autenticados por assinatura propria (Clerk/Stripe), nao por sessao
  // de navegador: exigir Basic auth ali quebraria a integracao server-to-server.
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) return null;

  const expectedUser = process.env.SANDBOX_BASIC_AUTH_USER;
  const expectedPassword = process.env.SANDBOX_BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    throw new Error(
      "APP_ENV=sandbox exige SANDBOX_BASIC_AUTH_USER e SANDBOX_BASIC_AUTH_PASSWORD definidos.",
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice("Basic ".length), "base64").toString(
      "utf-8",
    );
    const separatorIndex = decoded.indexOf(":");
    const providedUser =
      separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
    const providedPassword =
      separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);
    if (
      timingSafeEqual(providedUser, expectedUser) &&
      timingSafeEqual(providedPassword, expectedPassword)
    ) {
      return null;
    }
  }

  return new NextResponse("Autenticacao necessaria", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${SANDBOX_BASIC_AUTH_REALM}"` },
  });
}

const isPublicRoute = createRouteMatcher([
  "/",
  // Portal publico comercial (grupo de rotas `(public)/(marketing)`): landing,
  // paginas das duas vertentes e o pedido de orcamento. Sao paginas de
  // apresentacao, sem dado de tenant — precisam abrir sem sessao Clerk.
  "/seguranca-do-trabalho",
  "/medicina-do-trabalho",
  "/orcamento",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Assinatura publica de entrega de EPI: a credencial e o proprio token HMAC
  // (verificado na rota), nao a sessao Clerk.
  "/sign/(.*)",
  // Assinatura publica generica (fatia 010 + PGR na 022): a credencial e o token
  // (resolvido pela policy de capability), nao a sessao Clerk.
  "/signature-requests/(.*)",
  // Questionario psicossocial publico e anonimo (fatia 041): credencial = token
  // da campanha (policy de capability), nunca sessao Clerk.
  "/psychosocial-response/(.*)",
  "/api/webhooks/(.*)",
  ...(devApiBypass ? ["/api/v1/(.*)"] : []),
]);

// "/sign/" e "/signature-requests/" cobrem as rotas publicas de assinatura (nunca cachear o estado).
const NO_STORE_PATH_PREFIXES = [
  "/api/",
  "/sign-in",
  "/sign-up",
  "/sign/",
  "/signature-requests/",
  "/psychosocial-response/",
  "/dashboard",
];

export default clerkMiddleware(async (auth, request) => {
  const sandboxAuthResponse = checkSandboxBasicAuth(request);
  if (sandboxAuthResponse) return sandboxAuthResponse;

  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  if (!isPublicRoute(request)) {
    // Destino explicito do visitante anonimo. Sem isto, o Clerk manda para a
    // *account portal* hospedada (`...accounts.dev`), que ignora a tela de login
    // do produto e ainda exibe o nome antigo da aplicacao. O app tem a propria
    // rota publica `/sign-in` (design aprovado, Clerk real embutido) — e para la
    // que ele vai, com o retorno preservado.
    const signInUrl = new URL("/sign-in", request.nextUrl.origin);
    signInUrl.searchParams.set("redirect_url", request.nextUrl.href);
    await auth.protect({ unauthenticatedUrl: signInUrl.toString() });
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
