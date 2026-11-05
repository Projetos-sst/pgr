import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  changeCompanyModuleAction,
  getCompanyModuleOverviewAction,
} from "@/shared/server/actions/platform/company-modules";
import { listPgrAction } from "@/shared/server/actions/pgr/pgr";
import { changeCompanyModule } from "@/shared/server/platform/company-module-core";
import { ForbiddenError } from "@/shared/auth/errors";
import { GET, PUT } from "@/app/api/v1/companies/[id]/modules/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const ctx = {
  userId: "owner-1",
  tenantId: "org_a",
  role: "owner",
  plan: "free" as const,
};
(enabled ? describe : describe.skip)("company module management", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    // O banco exige que o ator seja administrador do escritório (NOB-170).
    await admin`insert into users (id, email) values ('owner-1','o1@example.test'), ('api-owner','api@example.test')`;
    await admin`insert into org_memberships (org_id, user_id, role) values ('org_a','owner-1','owner'), ('org_a','api-owner','org:admin')`;
    (requireOfficeStaff as jest.Mock).mockResolvedValue(ctx);
  });
  it("changes one company/service atomically and preserves Pro and records", async () => {
    const result = await changeCompanyModuleAction(I.companyA, {
      module: "pgr",
      enabled: false,
      reason: "Encerramento autorizado",
    });
    expect(result.ok).toBe(true);
    const view = await getCompanyModuleOverviewAction(I.companyA);
    expect(
      view.ok && view.data.modules.find((m) => m.module === "medicine")?.enabled,
    ).toBe(true);
    expect(view.ok && view.data.history.rows[0]).toMatchObject({
      changedBy: "owner-1",
      previousEnabled: true,
      enabled: false,
      reason: "Encerramento autorizado",
    });
    const pgr = await listPgrAction();
    expect(pgr.ok && pgr.data.total).toBe(0);
    expect(await admin`select id from pgr where company_id = ${I.companyA}`).toHaveLength(
      1,
    );
    expect((await admin`select plan from orgs where id = 'org_a'`)[0].plan).toBe("free");
  });
  it("allows first explicit activation and does not duplicate no-op events", async () => {
    const [company] =
      await admin`insert into companies (org_id,razao_social) values ('org_a','New') returning id`;
    const change = {
      module: "medicine" as const,
      enabled: true,
      reason: "Serviço autorizado",
    };
    await changeCompanyModuleAction(company.id, change);
    await changeCompanyModuleAction(company.id, change);
    const result = await getCompanyModuleOverviewAction(company.id);
    expect(
      result.ok && result.data.modules.find((m) => m.module === "pgr")?.enabled,
    ).toBe(false);
    expect(result.ok && result.data.history.total).toBe(1);
  });
  it("denies collaborator mutation while allowing consultation", async () => {
    (requireOfficeStaff as jest.Mock).mockResolvedValue({ ...ctx, role: "collaborator" });
    expect((await getCompanyModuleOverviewAction(I.companyA)).ok).toBe(true);
    const result = await changeCompanyModuleAction(I.companyA, {
      module: "pgr",
      enabled: false,
      reason: "Tentativa",
    });
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
    await expect(
      changeCompanyModule({ ...ctx, role: "client" }, I.companyA, {}),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await admin`select * from company_module_events`).toHaveLength(0);
  });
  it("rejects other tenant and invalid input without writing history", async () => {
    const result = await changeCompanyModuleAction(I.companyB, {
      module: "pgr",
      enabled: false,
      reason: "Tentativa",
    });
    expect(!result.ok && result.error.code).toBe("NOT_FOUND");
    const invalid = await changeCompanyModuleAction(I.companyA, {
      module: "medicine",
      enabled: true,
      reason: " ",
    });
    expect(!invalid.ok && invalid.error.code).toBe("VALIDATION");
    expect(await admin`select * from company_module_events`).toHaveLength(0);
  });
  it("serializes concurrent changes and keeps truthful event predecessors", async () => {
    await Promise.all([
      changeCompanyModule(ctx, I.companyA, {
        module: "pgr",
        enabled: false,
        reason: "Primeira",
      }),
      changeCompanyModule(ctx, I.companyA, {
        module: "pgr",
        enabled: true,
        reason: "Segunda",
      }),
    ]);
    const view = await getCompanyModuleOverviewAction(I.companyA);
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const chronological = [...view.data.history.rows].reverse();
    let state = true;
    for (const event of chronological) {
      expect(event.previousEnabled).toBe(state);
      state = event.enabled;
    }
    expect(view.data.modules.find((m) => m.module === "pgr")?.enabled).toBe(state);
  });
  it("rolls back the entitlement when its audit event cannot be stored", async () => {
    await admin`revoke insert on company_module_events from app_runtime`;
    try {
      const result = await changeCompanyModuleAction(I.companyA, {
        module: "pgr",
        enabled: false,
        reason: "Atomicidade",
      });
      expect(result.ok).toBe(false);
      const [row] =
        await admin`select enabled from company_modules where company_id = ${I.companyA} and module = 'pgr'`;
      expect(row.enabled).toBe(true);
      expect(await admin`select * from company_module_events`).toHaveLength(0);
    } finally {
      await admin`grant insert on company_module_events to app_runtime`;
    }
  });
  it("enforces the same owner and tenant rules over REST", async () => {
    const previousApp = process.env.APP_ENV;
    const previousBypass = process.env.DEV_API_AUTH_BYPASS;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    const request = (method: string, role: string, tenant = "org_a") =>
      new NextRequest(`http://localhost/api/v1/companies/${I.companyA}/modules`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-dev-role": role,
          "x-dev-tenant": tenant,
          "x-dev-user": "api-owner",
        },
        ...(method === "PUT"
          ? {
              body: JSON.stringify({
                module: "medicine",
                enabled: false,
                reason: "Teste HTTP",
              }),
            }
          : {}),
      });
    const routeContext = { params: Promise.resolve({ id: I.companyA }) };
    try {
      expect((await GET(request("GET", "collaborator"), routeContext)).status).toBe(200);
      expect((await PUT(request("PUT", "collaborator"), routeContext)).status).toBe(403);
      expect((await GET(request("GET", "client"), routeContext)).status).toBe(403);
      expect((await PUT(request("PUT", "owner", "org_b"), routeContext)).status).toBe(
        404,
      );
      expect((await PUT(request("PUT", "owner"), routeContext)).status).toBe(200);
      const malformed = new NextRequest(
        `http://localhost/api/v1/companies/${I.companyA}/modules`,
        {
          method: "PUT",
          body: "{",
          headers: {
            "content-type": "application/json",
            "x-dev-role": "owner",
            "x-dev-tenant": "org_a",
          },
        },
      );
      expect((await PUT(malformed, routeContext)).status).toBe(422);
    } finally {
      if (previousApp === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previousApp;
      if (previousBypass === undefined) delete process.env.DEV_API_AUTH_BYPASS;
      else process.env.DEV_API_AUTH_BYPASS = previousBypass;
    }
  });
});
