/**
 * Integração da camada REST /api/v1/epi-catalog contra Postgres efêmero, via
 * bypass dev — espelho do rest-companies. Cobre verbos, filtro por tipo,
 * cross-tenant 404, papel client 403, dependentes e IN_USE no delete.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
// O bypass dev nunca chama requireOfficeStaff; mockamos so para evitar a cadeia
// Supabase no import. OFFICE_STAFF_ROLES precisa existir no mock: o restHandler
// usa o Set no gate de papel do bypass (fatia 012) — replicado inline.
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { GET, POST } from "@/app/api/v1/epi-catalog/route";
import {
  GET as GET_ID,
  PUT as PUT_ID,
  DELETE as DELETE_ID,
} from "@/app/api/v1/epi-catalog/[id]/route";
import { GET as GET_DEPENDENTS } from "@/app/api/v1/epi-catalog/[id]/dependents/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const URL_BASE = "http://localhost/api/v1/epi-catalog";

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

const VALID_INPUT = {
  type: "epi",
  categoryId: PGR_IDS.categoryA,
  name: "Luva Nitrílica",
  ca: "12345",
};

(shouldRun ? describe : describe.skip)("REST /api/v1/epi-catalog", () => {
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
    expect(body.rows[0].name).toBe("Capacete CA-123");
  });

  it("GET com filtro type sem correspondência → lista vazia", async () => {
    const res = await GET(req({ method: "GET", query: "?type=machine" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
  });

  it("POST cria item de catálogo (201)", async () => {
    const res = await POST(req({ method: "POST", body: JSON.stringify(VALID_INPUT) }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Luva Nitrílica");
    expect(body.orgId).toBe("org_a");
  });

  it("POST sem categoria → 422 VALIDATION", async () => {
    const res = await POST(
      req({ method: "POST", body: JSON.stringify({ type: "epi", name: "X" }) }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("POST com categoria de outro tenant → rejeitado", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({ ...VALID_INPUT, categoryId: PGR_IDS.categoryB }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("papel client → 403 FORBIDDEN", async () => {
    const res = await GET(req({ method: "GET", role: "client" }));
    expect(res.status).toBe(403);
  });

  it("GET by id de outro tenant → 404 NOT_FOUND", async () => {
    const res = await GET_ID(req({ method: "GET" }), {
      params: Promise.resolve({ id: PGR_IDS.epiCatalogB }),
    });
    expect(res.status).toBe(404);
  });

  it("PUT atualiza no tenant (200)", async () => {
    const res = await PUT_ID(
      req({
        method: "PUT",
        body: JSON.stringify({ ...VALID_INPUT, name: "Capacete Editado" }),
      }),
      { params: Promise.resolve({ id: PGR_IDS.epiCatalogA }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Capacete Editado");
  });

  it("GET dependents conta o estoque vinculado", async () => {
    const res = await GET_DEPENDENTS(req({ method: "GET" }), {
      params: Promise.resolve({ id: PGR_IDS.epiCatalogA }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stock).toBeGreaterThanOrEqual(1);
  });

  it("DELETE de item com estoque → 409 IN_USE (nada é removido)", async () => {
    const res = await DELETE_ID(req({ method: "DELETE" }), {
      params: Promise.resolve({ id: PGR_IDS.epiCatalogA }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("IN_USE");

    const still = await GET_ID(req({ method: "GET" }), {
      params: Promise.resolve({ id: PGR_IDS.epiCatalogA }),
    });
    expect(still.status).toBe(200);
  });

  it("DELETE de item sem dependentes → 204 e some (404 no GET)", async () => {
    const created = await POST(
      req({ method: "POST", body: JSON.stringify(VALID_INPUT) }),
    );
    const { id } = await created.json();

    const del = await DELETE_ID(req({ method: "DELETE" }), {
      params: Promise.resolve({ id }),
    });
    expect(del.status).toBe(204);

    const gone = await GET_ID(req({ method: "GET" }), {
      params: Promise.resolve({ id }),
    });
    expect(gone.status).toBe(404);
  });
});
