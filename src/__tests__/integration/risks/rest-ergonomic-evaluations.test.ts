/**
 * Integração da camada REST da avaliação ergonômica NR-17 (#40) contra Postgres
 * efêmero, via bypass dev.
 * Nested: /api/v1/risks/[id]/ergonomic-evaluations · Flat: /api/v1/ergonomic-evaluations/[id].
 *
 * NOTA: o harness REST-via-Jest pode retornar 500 por limitação pré-existente (mesma
 * dívida documentada em `jest.config.ts` para os demais `rest-*.test.ts`, que ficam
 * fora do CI). Este arquivo segue o mesmo padrão e é validado por execução direta +
 * Postman/navegador autenticado no QA.
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
} from "@/app/api/v1/risks/[id]/ergonomic-evaluations/route";
import {
  GET as GET_ID,
  PUT as PUT_ID,
  DELETE as DELETE_ID,
} from "@/app/api/v1/ergonomic-evaluations/[id]/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const RANDOM_UUID = "99999999-9999-9999-9999-999999999999";
const EVALUATION_A = "11111111-1111-1111-1111-1111111111fc";
const EVALUATION_B = "22222222-2222-2222-2222-2222222222fc";

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
  assessedAt: "2026-09-20",
  responsible: "Ergonomista responsável",
  method: "RULA",
  posture: "inadequate",
  postureNotes: "Bancada baixa",
  mentalLoad: "not_applicable",
});

(shouldRun ? describe : describe.skip)("REST avaliações ergonômicas (NR-17)", () => {
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
    await admin.unsafe(`
      insert into public.ergonomic_evaluations (id, org_id, risk_id, assessed_at, posture) values
        ('${EVALUATION_A}','org_a','${PGR_IDS.riskA}','2026-01-01','adequate'),
        ('${EVALUATION_B}','org_b','${PGR_IDS.riskB}','2026-01-01','inadequate');
    `);
  });

  it("GET lista o histórico do risco do tenant (200)", async () => {
    const res = await LIST(req({ method: "GET" }), ctx(PGR_IDS.riskA));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
  });

  it("POST cria avaliação (201)", async () => {
    const res = await CREATE(
      req({ method: "POST", body: validCreate }),
      ctx(PGR_IDS.riskA),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.posture).toBe("inadequate");
    expect(body.mentalLoad).toBe("not_applicable");
    expect(body.movements).toBeNull();
  });

  it("POST sem data → 422 VALIDATION", async () => {
    const res = await CREATE(
      req({ method: "POST", body: JSON.stringify({ responsible: "x" }) }),
      ctx(PGR_IDS.riskA),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("POST com adequação fora do enum → 422 VALIDATION", async () => {
    const res = await CREATE(
      req({
        method: "POST",
        body: JSON.stringify({ assessedAt: "2026-09-20", posture: "otimo" }),
      }),
      ctx(PGR_IDS.riskA),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("POST em risco inexistente/cross-tenant → 422 FK_NOT_FOUND", async () => {
    const res = await CREATE(
      req({ method: "POST", body: validCreate }),
      ctx(RANDOM_UUID),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("FK_NOT_FOUND");

    const cross = await CREATE(
      req({ method: "POST", body: validCreate }),
      ctx(PGR_IDS.riskB),
    );
    expect(cross.status).toBe(422);
    expect((await cross.json()).error.code).toBe("FK_NOT_FOUND");
  });

  it("papel client → 403", async () => {
    const res = await LIST(req({ method: "GET", role: "client" }), ctx(PGR_IDS.riskA));
    expect(res.status).toBe(403);
  });

  it("GET by id de outro tenant → 404", async () => {
    const res = await GET_ID(req({ method: "GET" }), ctx(EVALUATION_B));
    expect(res.status).toBe(404);
  });

  it("PUT atualiza (200) e DELETE remove (204)", async () => {
    const put = await PUT_ID(
      req({ method: "PUT", body: validCreate }),
      ctx(EVALUATION_A),
    );
    expect(put.status).toBe(200);
    expect((await put.json()).method).toBe("RULA");
    const del = await DELETE_ID(req({ method: "DELETE" }), ctx(EVALUATION_A));
    expect(del.status).toBe(204);
  });

  it("PUT/DELETE de outro tenant → 404", async () => {
    const put = await PUT_ID(
      req({ method: "PUT", body: validCreate }),
      ctx(EVALUATION_B),
    );
    expect(put.status).toBe(404);
    const del = await DELETE_ID(req({ method: "DELETE" }), ctx(EVALUATION_B));
    expect(del.status).toBe(404);
  });
});
