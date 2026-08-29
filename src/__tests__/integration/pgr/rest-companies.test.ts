/**
 * Integração da camada REST (/api/v1) contra Postgres efêmero, via bypass dev.
 * Exercita o restHandler compartilhado (gate de papel, mapeamento erro->status,
 * 201/204, cross-tenant 404) pelos Route Handlers de Empresa.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
// O bypass dev nunca chama requireOfficeStaff; mockamos so para evitar a cadeia
// Supabase no import (auth real continua coberta pelos testes de Server Actions).
// OFFICE_STAFF_ROLES precisa existir no mock: o restHandler usa o Set no gate de
// papel do bypass (fatia 012) — replicado inline para nao puxar o modulo real.
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { GET, POST } from "@/app/api/v1/companies/route";
import {
  GET as GET_ID,
  PUT as PUT_ID,
  DELETE as DELETE_ID,
} from "@/app/api/v1/companies/[id]/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const URL_BASE = "http://localhost/api/v1/companies";

function req(
  opts: {
    method: string;
    body?: string;
    role?: string;
    tenant?: string;
    query?: string;
  } = { method: "GET" },
) {
  const { method, body, role = "owner", tenant = "org_a", query = "" } = opts;
  return new NextRequest(`${URL_BASE}${query}`, {
    method,
    body,
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-role": role,
    },
  });
}

(shouldRun ? describe : describe.skip)("REST /api/v1/companies (US1)", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
    delete process.env.DEV_API_AUTH_BYPASS;
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
  });

  it("GET lista só o tenant ativo (200)", async () => {
    const res = await GET(req({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.rows[0].razaoSocial).toBe("A Ltda");
  });

  it("POST cria empresa (201)", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({ razaoSocial: "Nova", riskGrade: 3 }),
      }),
    );
    expect(res.status).toBe(201);
  });

  it("POST com riskGrade inválido → 422 VALIDATION", async () => {
    const res = await POST(
      req({ method: "POST", body: JSON.stringify({ razaoSocial: "X", riskGrade: 9 }) }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("POST CNPJ duplicado no tenant → 409 DUPLICATE", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({
          razaoSocial: "Clone",
          riskGrade: 1,
          cnpj: "11222333000181",
        }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("papel client → 403 FORBIDDEN", async () => {
    const res = await GET(req({ method: "GET", role: "client" }));
    expect(res.status).toBe(403);
  });

  it("GET by id de outro tenant → 404 NOT_FOUND", async () => {
    const res = await GET_ID(req({ method: "GET" }), {
      params: Promise.resolve({ id: PGR_IDS.companyB }),
    });
    expect(res.status).toBe(404);
  });

  it("PUT atualiza no tenant (200) e DELETE remove (204)", async () => {
    const put = await PUT_ID(
      req({ method: "PUT", body: JSON.stringify({ razaoSocial: "A2", riskGrade: 2 }) }),
      { params: Promise.resolve({ id: PGR_IDS.companyA }) },
    );
    expect(put.status).toBe(200);

    const del = await DELETE_ID(req({ method: "DELETE" }), {
      params: Promise.resolve({ id: PGR_IDS.companyA }),
    });
    expect(del.status).toBe(204);
  });
});
