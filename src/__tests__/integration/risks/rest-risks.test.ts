/**
 * Integração da camada REST (/api/v1/risks) contra Postgres efêmero, via bypass dev.
 * Exercita o restHandler (gate de papel, mapeamento erro→status, 201/204, cross-tenant 404).
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { GET, POST } from "@/app/api/v1/risks/route";
import {
  GET as GET_ID,
  PUT as PUT_ID,
  DELETE as DELETE_ID,
} from "@/app/api/v1/risks/[id]/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const URL_BASE = "http://localhost/api/v1/risks";
const RANDOM_UUID = "99999999-9999-9999-9999-999999999999";

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

const validCreate = JSON.stringify({
  gesId: PGR_IDS.gesA,
  agentType: "physical",
  description: "Ruído contínuo",
});

(shouldRun ? describe : describe.skip)("REST /api/v1/risks (US1)", () => {
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
    expect(body.rows[0].gesName).toBe("GES A");
  });

  it("POST cria risco (201)", async () => {
    const res = await POST(req({ method: "POST", body: validCreate }));
    expect(res.status).toBe(201);
  });

  it("POST sem description/agentType → 422 VALIDATION", async () => {
    const res = await POST(
      req({ method: "POST", body: JSON.stringify({ gesId: PGR_IDS.gesA }) }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("POST qualitative_na + concentração → 422 VALIDATION", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({
          gesId: PGR_IDS.gesA,
          agentType: "physical",
          description: "x",
          measurementUnit: "qualitative_na",
          concentrationIntensity: "5",
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("POST com gesId inválido → 422 FK_NOT_FOUND", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({
          gesId: RANDOM_UUID,
          agentType: "physical",
          description: "x",
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("FK_NOT_FOUND");
  });

  it("papel client → 403 FORBIDDEN", async () => {
    const res = await GET(req({ method: "GET", role: "client" }));
    expect(res.status).toBe(403);
  });

  it("GET by id de outro tenant → 404", async () => {
    const res = await GET_ID(req({ method: "GET" }), {
      params: Promise.resolve({ id: PGR_IDS.riskB }),
    });
    expect(res.status).toBe(404);
  });

  it("PUT atualiza no tenant (200) e DELETE remove (204)", async () => {
    const put = await PUT_ID(
      req({
        method: "PUT",
        body: JSON.stringify({
          gesId: PGR_IDS.gesA,
          agentType: "chemical",
          description: "Atualizado",
        }),
      }),
      { params: Promise.resolve({ id: PGR_IDS.riskA }) },
    );
    expect(put.status).toBe(200);

    const del = await DELETE_ID(req({ method: "DELETE" }), {
      params: Promise.resolve({ id: PGR_IDS.riskA }),
    });
    expect(del.status).toBe(204);
  });

  it("PUT/DELETE de outro tenant → 404 (nunca 409)", async () => {
    const put = await PUT_ID(
      req({
        method: "PUT",
        body: JSON.stringify({
          gesId: PGR_IDS.gesA,
          agentType: "physical",
          description: "x",
        }),
      }),
      { params: Promise.resolve({ id: PGR_IDS.riskB }) },
    );
    expect(put.status).toBe(404);
    const del = await DELETE_ID(req({ method: "DELETE" }), {
      params: Promise.resolve({ id: PGR_IDS.riskB }),
    });
    expect(del.status).toBe(404);
  });
});
