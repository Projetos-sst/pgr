/**
 * Integração da camada REST (/api/v1/pgr) contra Postgres efêmero, via bypass dev.
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

import { GET, POST } from "@/app/api/v1/pgr/route";
import {
  GET as GET_ID,
  PUT as PUT_ID,
  DELETE as DELETE_ID,
} from "@/app/api/v1/pgr/[id]/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const URL_BASE = "http://localhost/api/v1/pgr";
const RANDOM_UUID = "99999999-9999-9999-9999-999999999999";

function req(
  opts: {
    method: string;
    body?: string;
    role?: string;
    tenant?: string;
    query?: string;
  } = {
    method: "GET",
  },
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
  companyId: PGR_IDS.companyA,
  workUnitId: PGR_IDS.workUnitA,
  registrationType: "not_applicable",
  issuedAt: "2026-01-10",
  validUntil: "2027-01-10",
  declarationAccepted: true,
});

(shouldRun ? describe : describe.skip)("REST /api/v1/pgr (US1/US2)", () => {
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
    expect(body.rows[0].companyName).toBe("A Ltda");
  });

  it("POST cria PGR com aceite (201)", async () => {
    const res = await POST(req({ method: "POST", body: validCreate }));
    expect(res.status).toBe(201);
  });

  it("POST sem aceite → 422 VALIDATION", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({
          companyId: PGR_IDS.companyA,
          registrationType: "not_applicable",
          issuedAt: "2026-01-10",
          validUntil: "2027-01-10",
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("POST com empresa inválida → 422 FK_NOT_FOUND", async () => {
    const res = await POST(
      req({
        method: "POST",
        body: JSON.stringify({
          companyId: RANDOM_UUID,
          registrationType: "not_applicable",
          issuedAt: "2026-01-10",
          validUntil: "2027-01-10",
          declarationAccepted: true,
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
      params: Promise.resolve({ id: PGR_IDS.pgrB }),
    });
    expect(res.status).toBe(404);
  });

  it("PUT atualiza no tenant (200) e DELETE remove (204)", async () => {
    const put = await PUT_ID(
      req({
        method: "PUT",
        body: JSON.stringify({
          companyId: PGR_IDS.companyA,
          registrationType: "not_applicable",
          issuedAt: "2026-01-10",
          validUntil: "2027-06-10",
        }),
      }),
      { params: Promise.resolve({ id: PGR_IDS.pgrA }) },
    );
    expect(put.status).toBe(200);

    const del = await DELETE_ID(req({ method: "DELETE" }), {
      params: Promise.resolve({ id: PGR_IDS.pgrA }),
    });
    expect(del.status).toBe(204);
  });

  it("PUT/DELETE de outro tenant → 404 (nunca 409)", async () => {
    const put = await PUT_ID(
      req({
        method: "PUT",
        body: JSON.stringify({
          companyId: PGR_IDS.companyA,
          registrationType: "not_applicable",
          issuedAt: "2026-01-10",
          validUntil: "2027-01-10",
        }),
      }),
      { params: Promise.resolve({ id: PGR_IDS.pgrB }) },
    );
    expect(put.status).toBe(404);
    const del = await DELETE_ID(req({ method: "DELETE" }), {
      params: Promise.resolve({ id: PGR_IDS.pgrB }),
    });
    expect(del.status).toBe(404);
  });
});
