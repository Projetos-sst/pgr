/**
 * Integração da camada REST da Medicina contra Postgres efêmero, via bypass dev —
 * padrão de `pgr/rest-health-exams.test.ts` (import direto dos handlers). Cobre
 * `/api/v1/medicine/overview` (200/403), `/api/v1/medicine/employees`
 * (200/422/403/404) e os filtros `?employeeId=`/`?companyId=` de
 * `/api/v1/health-exams` (200/422).
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

import { GET as GET_OVERVIEW } from "@/app/api/v1/medicine/overview/route";
import { GET as GET_EMPLOYEES } from "@/app/api/v1/medicine/employees/route";
import { GET as GET_EXAMS } from "@/app/api/v1/health-exams/route";

import { adminClient, applyMigrations } from "../_helpers/db";
import {
  MEDICINE_IDS as M,
  expectNoSensitiveFields,
  seedMedicine,
} from "../_helpers/medicine-seed";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

function req(
  path: string,
  opts: { role?: string; tenant?: string | null; query?: string } = {},
) {
  const { role = "owner", tenant = "org_a", query = "" } = opts;
  const headers: Record<string, string> = { "x-dev-role": role };
  if (tenant) headers["x-dev-tenant"] = tenant;
  return new NextRequest(`http://localhost${path}${query}`, { method: "GET", headers });
}

const overviewReq = (opts?: Parameters<typeof req>[1]) =>
  req("/api/v1/medicine/overview", opts);
const employeesReq = (query: string, opts?: Parameters<typeof req>[1]) =>
  req("/api/v1/medicine/employees", { ...opts, query });
const examsReq = (query: string, opts?: Parameters<typeof req>[1]) =>
  req("/api/v1/health-exams", { ...opts, query });

(shouldRun ? describe : describe.skip)(
  "REST /api/v1/medicine + filtros de exames",
  () => {
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
      await seedMedicine(admin);
    });

    describe("GET /api/v1/medicine/overview", () => {
      it("200 com empresas do tenant que têm Medicina", async () => {
        const res = await GET_OVERVIEW(overviewReq());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.companies.map((c: { companyId: string }) => c.companyId)).toEqual([
          I.companyA,
          M.companyA2,
        ]);
        expect(body.totals).toMatchObject({
          companies: 2,
          employees: 2,
          ok: 1,
          noExpiry: 1,
        });
        expectNoSensitiveFields(body);
      });

      it("papel client → 403 FORBIDDEN", async () => {
        const res = await GET_OVERVIEW(overviewReq({ role: "client" }));
        expect(res.status).toBe(403);
        expect((await res.json()).error.code).toBe("FORBIDDEN");
      });

      it("sem tenant → 403 NO_TENANT_CONTEXT", async () => {
        const res = await GET_OVERVIEW(overviewReq({ tenant: null }));
        expect(res.status).toBe(403);
        expect((await res.json()).error.code).toBe("NO_TENANT_CONTEXT");
      });
    });

    describe("GET /api/v1/medicine/employees", () => {
      it("200 com latestExam e total", async () => {
        const res = await GET_EMPLOYEES(employeesReq(`?companyId=${I.companyA}`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(1);
        expect(body.rows[0]).toMatchObject({
          id: I.employeeA,
          latestExam: { examType: "periodic", performedAt: "2026-01-10" },
        });
        expectNoSensitiveFields(body);
      });

      it("200 com busca e paginação via query string", async () => {
        const res = await GET_EMPLOYEES(
          employeesReq(`?companyId=${M.companyA2}&search=A2&page=1&pageSize=5`),
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(1);
        expect(body.rows[0].id).toBe(M.employeeA2);
      });

      it("companyId ausente/malformado → 422 VALIDATION", async () => {
        for (const query of ["", "?companyId=", "?companyId=abc"]) {
          const res = await GET_EMPLOYEES(employeesReq(query));
          expect(res.status).toBe(422);
          expect((await res.json()).error.code).toBe("VALIDATION");
        }
      });

      it("pageSize > 100 → 422 VALIDATION", async () => {
        const res = await GET_EMPLOYEES(
          employeesReq(`?companyId=${I.companyA}&pageSize=500`),
        );
        expect(res.status).toBe(422);
      });

      it("companyA3 (sem Medicina) → 403 FORBIDDEN", async () => {
        const res = await GET_EMPLOYEES(employeesReq(`?companyId=${M.companyA3}`));
        expect(res.status).toBe(403);
        expect((await res.json()).error.code).toBe("FORBIDDEN");
      });

      it("empresa de org_b → 404 NOT_FOUND", async () => {
        const res = await GET_EMPLOYEES(employeesReq(`?companyId=${I.companyB}`));
        expect(res.status).toBe(404);
        expect((await res.json()).error.code).toBe("NOT_FOUND");
      });

      it("papel client → 403", async () => {
        const res = await GET_EMPLOYEES(
          employeesReq(`?companyId=${I.companyA}`, { role: "client" }),
        );
        expect(res.status).toBe(403);
      });
    });

    describe("GET /api/v1/health-exams?employeeId=|companyId=", () => {
      it("?employeeId= → 200 só do funcionário", async () => {
        const res = await GET_EXAMS(examsReq(`?employeeId=${I.employeeA}`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(2);
        expect(
          body.rows.every((r: { employeeId: string }) => r.employeeId === I.employeeA),
        ).toBe(true);
        expectNoSensitiveFields(body);
      });

      it("?companyId= → 200 só da empresa (sem vazar companyA2)", async () => {
        const res = await GET_EXAMS(examsReq(`?companyId=${M.companyA2}`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(1);
        expect(body.rows[0].id).toBe(M.examA2);
      });

      it("?employeeId= de org_b → 200 lista vazia", async () => {
        const res = await GET_EXAMS(examsReq(`?employeeId=${I.employeeB}`));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ total: 0, rows: [] });
      });

      it("ID malformado → 422 VALIDATION (não lista vazia)", async () => {
        for (const query of ["?employeeId=invalido", "?companyId=abc"]) {
          const res = await GET_EXAMS(examsReq(query));
          expect(res.status).toBe(422);
          expect((await res.json()).error.code).toBe("VALIDATION");
        }
      });
    });
  },
);
