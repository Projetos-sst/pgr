/**
 * Integração da camada REST (medidas de controle) contra Postgres efêmero, via bypass dev.
 * Nested: /api/v1/risks/[id]/control-measures · Flat: /api/v1/control-measures/[id].
 *
 * NOTA: o harness REST-via-Jest pode retornar 500 por limitação pré-existente (provado com
 * rest-pgr / rest-risk-assessments). Se ocorrer, validar o REST por cURL (quickstart.md).
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import {
  GET as LIST,
  POST as CREATE,
} from "@/app/api/v1/risks/[id]/control-measures/route";
import {
  GET as GET_ID,
  PUT as PUT_ID,
  DELETE as DELETE_ID,
} from "@/app/api/v1/control-measures/[id]/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const RANDOM_UUID = "99999999-9999-9999-9999-999999999999";

function req(
  opts: { method: string; body?: string; role?: string; tenant?: string } = {
    method: "GET",
  },
) {
  const { method, body, role = "owner", tenant = "org_a" } = opts;
  return new NextRequest("http://localhost/api/v1", {
    method,
    body,
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-role": role,
    },
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const validCreate = JSON.stringify({
  controlLevel: "collective_protection",
  applicable: true,
  actionWhat: "Enclausuramento acústico",
  actionHow: "Projeto + execução",
  actionDeadline: "2026-09-30",
});

(shouldRun ? describe : describe.skip)("REST medidas de controle", () => {
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

  it("GET lista do risco do tenant (200)", async () => {
    const res = await LIST(req({ method: "GET" }), ctx(PGR_IDS.riskA));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
  });

  it("POST cria medida (201)", async () => {
    const res = await CREATE(
      req({ method: "POST", body: validCreate }),
      ctx(PGR_IDS.riskA),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.controlLevel).toBe("collective_protection");
  });

  it("POST nível duplicado → 409 DUPLICATE", async () => {
    const dup = JSON.stringify({ controlLevel: "elimination", applicable: false });
    const res = await CREATE(req({ method: "POST", body: dup }), ctx(PGR_IDS.riskA));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("DUPLICATE");
  });

  it("POST validação inválida (applicable=true sem actionWhat) → 422", async () => {
    const bad = JSON.stringify({ controlLevel: "administrative", applicable: true });
    const res = await CREATE(req({ method: "POST", body: bad }), ctx(PGR_IDS.riskA));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("POST com riskId inválido → 422 FK_NOT_FOUND", async () => {
    const res = await CREATE(
      req({ method: "POST", body: validCreate }),
      ctx(RANDOM_UUID),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("FK_NOT_FOUND");
  });

  it("papel client → 403", async () => {
    const res = await LIST(req({ method: "GET", role: "client" }), ctx(PGR_IDS.riskA));
    expect(res.status).toBe(403);
  });

  it("GET by id de outro tenant → 404", async () => {
    const res = await GET_ID(req({ method: "GET" }), ctx(PGR_IDS.controlMeasureB));
    expect(res.status).toBe(404);
  });

  it("PUT atualiza (200) e DELETE remove (204)", async () => {
    const put = await PUT_ID(
      req({ method: "PUT", body: validCreate }),
      ctx(PGR_IDS.controlMeasureA),
    );
    expect(put.status).toBe(200);
    const del = await DELETE_ID(req({ method: "DELETE" }), ctx(PGR_IDS.controlMeasureA));
    expect(del.status).toBe(204);
  });

  it("PUT/DELETE de outro tenant → 404", async () => {
    const put = await PUT_ID(
      req({ method: "PUT", body: validCreate }),
      ctx(PGR_IDS.controlMeasureB),
    );
    expect(put.status).toBe(404);
    const del = await DELETE_ID(req({ method: "DELETE" }), ctx(PGR_IDS.controlMeasureB));
    expect(del.status).toBe(404);
  });
});
