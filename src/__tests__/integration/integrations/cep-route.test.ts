/**
 * Integração do Route Handler de CEP com `fetch` externo e sessão mockados — não
 * toca banco (CEP é dado público). Cobre 200/404/502/422 e o guard de sessão 401.
 */
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { GET } from "@/app/api/integrations/cep/[cep]/route";
import { clearCepCache } from "@/shared/integrations/cep";

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

function call(cep: string) {
  return GET({} as unknown as NextRequest, { params: Promise.resolve({ cep }) });
}

describe("GET /api/integrations/cep/[cep]", () => {
  beforeEach(() => {
    clearCepCache();
    (global as { fetch: unknown }).fetch = jest.fn();
    setAuthenticated(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it("sucesso (200) devolve ActionResult ok com o endereço", async () => {
    mockFetchResolve(200, {
      cep: "01001-000",
      logradouro: "Praça da Sé",
      bairro: "Sé",
      localidade: "São Paulo",
      uf: "SP",
    });
    const res = await call("01001000");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.city).toBe("São Paulo");
  });

  it("CEP não encontrado → 404 NOT_FOUND", async () => {
    mockFetchResolve(200, { erro: true });
    const res = await call("99999999");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("timeout do provider → 502 UPSTREAM_ERROR", async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    const res = await call("01001000");
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("UPSTREAM_ERROR");
  });

  it("formato inválido → 422 sem chamar o provider", async () => {
    const res = await call("123");
    expect(res.status).toBe(422);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sem sessão → 401 UNAUTHORIZED", async () => {
    setAuthenticated(false);
    const res = await call("01001000");
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
