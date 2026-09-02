/**
 * Integração da camada REST /api/v1/health-exams contra Postgres efêmero, via
 * bypass dev — espelho do rest-epi-catalog. Cobre verbos, filtro por tipo, busca
 * por rótulo de exame, cross-tenant 404, papel client 403 e ciclo delete.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { GET, POST } from "@/app/api/v1/health-exams/route";
import {
  GET as GET_ID,
  PUT as PUT_ID,
  DELETE as DELETE_ID,
} from "@/app/api/v1/health-exams/[id]/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const URL_BASE = "http://localhost/api/v1/health-exams";

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
  employeeId: PGR_IDS.employeeA,
  examType: "admissional",
  performedAt: "2026-01-14",
  validUntil: "2027-01-14",
  aptitude: "fit",
};

(shouldRun ? describe : describe.skip)("REST /api/v1/health-exams", () => {
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

  it("GET lista vazia inicialmente (200)", async () => {
    const res = await GET(req({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
  });

  it("POST cria exame (201) e GET passa a listar", async () => {
    const post = await POST(req({ method: "POST", body: JSON.stringify(VALID_INPUT) }));
    expect(post.status).toBe(201);
    const created = await post.json();
    expect(created.orgId).toBe("org_a");

    const res = await GET(req({ method: "GET" }));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.rows[0].employeeName).toBe("Func A");
  });

  it("GET busca por rótulo do tipo de exame (?search=periód)", async () => {
    await POST(req({ method: "POST", body: JSON.stringify(VALID_INPUT) }));
    await POST(
      req({
        method: "POST",
        body: JSON.stringify({ ...VALID_INPUT, examType: "periodic" }),
      }),
    );
    const res = await GET(req({ method: "GET", query: "?search=peri%C3%B3d" }));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.rows[0].examType).toBe("periodic");
  });

  it("POST com data futura → 422 VALIDATION", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({ ...VALID_INPUT, performedAt: "2999-01-01" }),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("POST com funcionário de outro tenant → 422 FK_NOT_FOUND", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({ ...VALID_INPUT, employeeId: PGR_IDS.employeeB }),
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

  it("GET by id de outro tenant → 404 NOT_FOUND", async () => {
    const created = await POST(
      req({
        method: "POST",
        tenant: "org_b",
        body: JSON.stringify({ ...VALID_INPUT, employeeId: PGR_IDS.employeeB }),
      }),
    );
    const { id } = await created.json();
    const res = await GET_ID(req({ method: "GET" }), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(404);
  });

  it("PUT atualiza no tenant (200) e DELETE remove (204 → 404)", async () => {
    const created = await POST(
      req({ method: "POST", body: JSON.stringify(VALID_INPUT) }),
    );
    const { id } = await created.json();

    const put = await PUT_ID(
      req({
        method: "PUT",
        body: JSON.stringify({ ...VALID_INPUT, aptitude: "fit_with_restrictions" }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(put.status).toBe(200);
    const updated = await put.json();
    expect(updated.aptitude).toBe("fit_with_restrictions");

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
