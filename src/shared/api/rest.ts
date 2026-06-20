import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError, NoTenantContextError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { toActionError } from "@/shared/server/action-error";

const HTTP_BY_CODE: Record<string, number> = {
  VALIDATION: 422,
  DUPLICATE: 409,
  FK_NOT_FOUND: 422,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  NO_TENANT_CONTEXT: 403,
  UNAUTHORIZED: 401,
};

const OFFICE_ROLES = new Set(["owner", "collaborator"]);

/**
 * Dev-only auth bypass for local/homolog testing (Postman sem token Clerk).
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

async function resolveContext(req: NextRequest): Promise<TenantContext> {
  if (isDevAuthBypassEnabled()) {
    const dev = devContextFrom(req);
    if (dev) {
      if (!OFFICE_ROLES.has(dev.role)) throw new ForbiddenError();
      return dev;
    }
    throw new NoTenantContextError();
  }
  return requireOfficeStaff();
}

/**
 * Envolve um Route Handler REST: resolve o contexto (auth real ou bypass dev),
 * executa `fn`, serializa o resultado e mapeia erros conhecidos para o status HTTP.
 * `status` 201 (create) e 204 (delete) suportados; erro inesperado → 500.
 */
export async function restHandler<T>(
  req: NextRequest,
  fn: (ctx: TenantContext) => Promise<T>,
  opts: { status?: number } = {},
): Promise<NextResponse> {
  try {
    const ctx = await resolveContext(req);
    const data = await fn(ctx);
    const status = opts.status ?? 200;
    if (status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(data ?? null, { status });
  } catch (error) {
    const mapped = toActionError(error);
    if (mapped) {
      return NextResponse.json(
        { error: mapped },
        { status: HTTP_BY_CODE[mapped.code] ?? 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Erro inesperado." } },
      { status: 500 },
    );
  }
}

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
