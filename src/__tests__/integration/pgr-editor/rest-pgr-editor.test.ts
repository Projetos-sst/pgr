/**
 * Integração da camada REST (editor do PGR) contra Postgres efêmero, via bypass dev.
 * ges: /api/v1/pgr/[id]/ges · /ges/[gesId] · revisions · consolidated.
 *
 * NOTA: o harness REST-via-Jest pode retornar 500 por limitação pré-existente (provado com
 * rest-pgr / rest-risk-assessments / rest-control-measures). Se ocorrer, validar por cURL.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { GET as GES_LIST, POST as GES_ADD } from "@/app/api/v1/pgr/[id]/ges/route";
import { DELETE as GES_REMOVE } from "@/app/api/v1/pgr/[id]/ges/[gesId]/route";
import {
  GET as REV_LIST,
  POST as REV_CREATE,
} from "@/app/api/v1/pgr/[id]/revisions/route";
import { GET as CONSOLIDATED } from "@/app/api/v1/pgr/[id]/consolidated/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

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
const ctx2 = (id: string, gesId: string) => ({ params: Promise.resolve({ id, gesId }) });

(shouldRun ? describe : describe.skip)("REST editor do PGR", () => {
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

  it("GET ges lista vinculados (200)", async () => {
    const res = await GES_LIST(req({ method: "GET" }), ctx(PGR_IDS.pgrA));
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(1);
  });

  it("POST ges duplicado → 409", async () => {
    const res = await GES_ADD(
      req({ method: "POST", body: JSON.stringify({ gesId: PGR_IDS.gesA }) }),
      ctx(PGR_IDS.pgrA),
    );
    expect(res.status).toBe(409);
  });

  it("POST ges de outro tenant → 422 FK_NOT_FOUND", async () => {
    const res = await GES_ADD(
      req({ method: "POST", body: JSON.stringify({ gesId: PGR_IDS.gesB }) }),
      ctx(PGR_IDS.pgrA),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("FK_NOT_FOUND");
  });

  it("DELETE ges remove vínculo (204)", async () => {
    const res = await GES_REMOVE(
      req({ method: "DELETE" }),
      ctx2(PGR_IDS.pgrA, PGR_IDS.gesA),
    );
    expect(res.status).toBe(204);
  });

  it("GET revisions (200) e POST com revisionNumber → 422 (schema estrito)", async () => {
    const list = await REV_LIST(req({ method: "GET" }), ctx(PGR_IDS.pgrA));
    expect(list.status).toBe(200);
    const bad = await REV_CREATE(
      req({
        method: "POST",
        body: JSON.stringify({ revisionNumber: 99, revisedAt: "2026-07-12" }),
      }),
      ctx(PGR_IDS.pgrA),
    );
    expect(bad.status).toBe(422);
  });

  it("POST revision válida (sem número, calculado no servidor) → 201", async () => {
    const res = await REV_CREATE(
      req({ method: "POST", body: JSON.stringify({ revisedAt: "2026-07-12" }) }),
      ctx(PGR_IDS.pgrA),
    );
    expect(res.status).toBe(201);
  });

  it("GET consolidated (200)", async () => {
    const res = await CONSOLIDATED(req({ method: "GET" }), ctx(PGR_IDS.pgrA));
    expect(res.status).toBe(200);
    expect((await res.json()).ges.length).toBe(1);
  });

  it("papel client → 403", async () => {
    const res = await GES_LIST(req({ method: "GET", role: "client" }), ctx(PGR_IDS.pgrA));
    expect(res.status).toBe(403);
  });

  it("PGR cross-tenant → 404 (consolidated)", async () => {
    const res = await CONSOLIDATED(req({ method: "GET" }), ctx(PGR_IDS.pgrB));
    expect(res.status).toBe(404);
  });
});
