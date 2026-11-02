import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import {
  requireOfficeStaff,
  OFFICE_STAFF_ROLES,
} from "@/shared/auth/require-office-staff";
import { ForbiddenError, NoTenantContextError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { toActionError } from "@/shared/server/action-error";
import { logTenantEvent, safeErrorMessage } from "@/shared/tenant/audit-log";

const HTTP_BY_CODE: Record<string, number> = {
  VALIDATION: 422,
  DUPLICATE: 409,
  FK_NOT_FOUND: 422,
  IN_USE: 409,
  INSUFFICIENT_STOCK: 422,
  ALREADY_SIGNED: 409,
  ALREADY_RETURNED: 409,
  DOCUMENT_VERSION_READ_ONLY: 409,
  TOKEN_INVALID: 404,
  TOKEN_EXPIRED: 410,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  NO_TENANT_CONTEXT: 403,
  UNAUTHORIZED: 401,
  QUOTA_EXCEEDED: 402,
  AI_UNAVAILABLE: 502,
  REPORT_UNAVAILABLE: 503,
  BILLING_UNAVAILABLE: 503,
};

const BLOCKED_CODES = new Set(["FORBIDDEN", "NO_TENANT_CONTEXT", "UNAUTHORIZED"]);
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Status HTTP do código de erro do contrato, com o mesmo mapa do `restHandler`.
 * Fallback 400. Usado também por rotas binárias (PDF) que não passam por
 * `restHandler` mas precisam do mesmo mapeamento (ex.: `UNAUTHORIZED → 401`).
 */
export function restStatusForCode(code: string): number {
  return HTTP_BY_CODE[code] ?? 400;
}

/**
 * Dev-only auth bypass para testar /api/v1 sem token Clerk (local/homolog).
 * IMPOSSÍVEL em produção: exige `APP_ENV !== "production"` E `DEV_API_AUTH_BYPASS === "true"`.
 * O tenant/papel vêm dos headers `x-dev-tenant`/`x-dev-role`/`x-dev-user` (ou das envs
 * `DEV_TENANT_ID`/`DEV_ROLE`/`DEV_USER_ID`).
 */
export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.APP_ENV !== "production" && process.env.DEV_API_AUTH_BYPASS === "true"
  );
}

function devContextFrom(req: NextRequest): TenantContext | null {
  const tenantId = req.headers.get("x-dev-tenant") ?? process.env.DEV_TENANT_ID ?? null;
  if (!tenantId) return null;
  const role = req.headers.get("x-dev-role") ?? process.env.DEV_ROLE ?? "owner";
  const userId = req.headers.get("x-dev-user") ?? process.env.DEV_USER_ID ?? "dev-user";
  return { tenantId, userId, role, plan: "free" };
}

export async function resolveContext(req: NextRequest): Promise<TenantContext> {
  if (isDevAuthBypassEnabled()) {
    const dev = devContextFrom(req);
    if (!dev) throw new NoTenantContextError();
    if (!OFFICE_STAFF_ROLES.has(dev.role)) throw new ForbiddenError();
    return dev;
  }
  return requireOfficeStaff();
}

/** Only explicit delegated endpoints use this; their core must check company access. */
export async function resolveTenantContext(req: NextRequest): Promise<TenantContext> {
  if (isDevAuthBypassEnabled()) {
    const dev = devContextFrom(req);
    if (!dev) throw new NoTenantContextError();
    return dev;
  }
  return (await import("@/shared/auth/require-tenant-context")).requireTenantContext();
}

function auditWrite(
  req: NextRequest,
  outcome: "ok" | "blocked" | "rejected",
  ctx: TenantContext | null,
): void {
  if (!MUTATION_METHODS.has(req.method)) return;
  logTenantEvent(outcome === "rejected" ? "error" : "info", {
    operation: `api.v1 ${req.method} ${req.nextUrl.pathname}`,
    outcome,
    orgId: ctx?.tenantId ?? null,
    userId: ctx?.userId ?? null,
  });
}

/**
 * Envolve um Route Handler REST: resolve o contexto (auth real ou bypass dev),
 * executa `fn`, serializa o resultado e mapeia erros conhecidos para o status HTTP.
 * Escritas (POST/PUT/PATCH/DELETE) emitem auditoria de fronteira sem PII (FR-064);
 * leituras não. Erro inesperado é logado (não silenciado) e vira 500.
 */
export async function restHandler<T>(
  req: NextRequest,
  fn: (ctx: TenantContext) => Promise<T>,
  opts: { status?: number; tenantAccess?: boolean } = {},
): Promise<NextResponse> {
  let ctx: TenantContext | null = null;
  try {
    ctx = opts.tenantAccess ? await resolveTenantContext(req) : await resolveContext(req);
    const data = await fn(ctx);
    auditWrite(req, "ok", ctx);
    const status = opts.status ?? 200;
    if (status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(data ?? null, { status });
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) {
      auditWrite(req, BLOCKED_CODES.has(mapped.code) ? "blocked" : "rejected", ctx);
      return NextResponse.json(
        { error: mapped },
        { status: HTTP_BY_CODE[mapped.code] ?? 400 },
      );
    }
    logTenantEvent("error", {
      operation: `api.v1 ${req.method} ${req.nextUrl.pathname}`,
      outcome: "rejected",
      orgId: ctx?.tenantId ?? null,
      userId: ctx?.userId ?? null,
      error: safeErrorMessage(error),
    });
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Erro inesperado." } },
      { status: 500 },
    );
  }
}

/** Extrai `search`/`page`/`pageSize` da query string (filtros específicos ficam no handler). */
export function pageParamsFrom(req: NextRequest): {
  page?: number;
  pageSize?: number;
  search?: string;
} {
  const sp = req.nextUrl.searchParams;
  const num = (v: string | null) => (v != null && v !== "" ? Number(v) : undefined);
  return {
    page: num(sp.get("page")),
    pageSize: num(sp.get("pageSize")),
    search: sp.get("search") ?? undefined,
  };
}
