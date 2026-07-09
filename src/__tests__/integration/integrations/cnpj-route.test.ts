/**
 * Integração do Route Handler de CNPJ com `fetch` externo e sessão mockados — não
 * toca banco (CNPJ é dado público). Cobre 200/404/502/422 e o guard de sessão 401.
 */
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { GET } from "@/app/api/integrations/cnpj/[cnpj]/route";
import { clearCnpjCache } from "@/shared/integrations/cnpj";

const mockAuth = auth as unknown as jest.Mock;

function setAuthenticated(authenticated: boolean) {
  mockAuth.mockResolvedValue(
    authenticated
      ? { isAuthenticated: true, userId: "u1", sessionId: "s1" }
      : { isAuthenticated: false, userId: null, sessionId: null },
  );
}

function mockFetchResolve(status: number, body: unknown) {
  (global as { fetch: unknown }).fetch = jest.fn(async () => ({
    status,
    json: async () => body,
  }));
}

function call(cnpj: string) {
  return GET({} as unknown as NextRequest, { params: Promise.resolve({ cnpj }) });
}

describe("GET /api/integrations/cnpj/[cnpj]", () => {
  beforeEach(() => {
    clearCnpjCache();
    (global as { fetch: unknown }).fetch = jest.fn();
    setAuthenticated(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it("sucesso (200) devolve ActionResult ok com razão social e endereço", async () => {
    mockFetchResolve(200, {
      cnpj: "11444777000161",
      razao_social: "Empresa Exemplo Ltda",
      municipio: "São Paulo",
      uf: "SP",
    });
    const res = await call("11444777000161");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.razaoSocial).toBe("Empresa Exemplo Ltda");
    expect(body.data.address.city).toBe("São Paulo");
  });

  it("CNPJ não encontrado → 404 NOT_FOUND", async () => {
    mockFetchResolve(404, { message: "não encontrado" });
    const res = await call("11444777000161");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("erro de rede → 502 UPSTREAM_ERROR", async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new Error("network down");
    });
    const res = await call("11444777000161");
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("UPSTREAM_ERROR");
  });

  it("formato inválido (dígito verificador) → 422 sem chamar o provider", async () => {
    const res = await call("11444777000162");
    expect(res.status).toBe(422);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sem sessão → 401 UNAUTHORIZED", async () => {
    setAuthenticated(false);
    const res = await call("11444777000161");
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
