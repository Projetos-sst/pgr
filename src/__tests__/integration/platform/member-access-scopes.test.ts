import { NextRequest } from "next/server";
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/auth/require-tenant-context", () => ({
  requireTenantContext: jest.fn(),
}));

import { GET as getCompany } from "@/app/api/v1/companies/[id]/route";
import { GET as listCompanies } from "@/app/api/v1/companies/route";
import { GET as getPgrPdf } from "@/app/api/v1/pgr/[id]/pdf/route";
import { GET as getPgr } from "@/app/api/v1/pgr/[id]/route";
import { DELETE as revokeScope } from "@/app/api/v1/team/[userId]/access-scopes/[scopeId]/route";
import {
  GET as listScopes,
  POST as grantScope,
} from "@/app/api/v1/team/[userId]/access-scopes/route";
import { ForbiddenError } from "@/shared/auth/errors";
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  requireTenantContext,
  type TenantContext,
} from "@/shared/auth/require-tenant-context";
import {
  getCompanyAction,
  listCompaniesAction,
  updateCompanyAction,
} from "@/shared/server/actions/pgr/companies";
import { listEmployeesAction } from "@/shared/server/actions/pgr/employees";
import { listHealthExamsAction } from "@/shared/server/actions/pgr/health-exams";
import { getPgrAction, listPgrAction } from "@/shared/server/actions/pgr/pgr";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import {
  getOwnAccessAreasAction,
  grantAccessScopeAction,
  listAccessScopesAction,
  revokeAccessScopeAction,
} from "@/shared/server/actions/platform/access-scopes";

import { ACCESS_IDS as X, seedAccessScopeFixtures } from "../_helpers/access-scope-seed";
import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS as I, seedPgrBase } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

type Role = "owner" | "collaborator" | "client";

function signIn(userId: string, role: Role, tenantId = "org_a"): void {
  const ctx: TenantContext = { userId, tenantId, role, plan: "pro" };
  jest.mocked(requireTenantContext).mockResolvedValue(ctx);
  if (role === "client") {
    jest.mocked(requireOfficeStaff).mockRejectedValue(new ForbiddenError());
    return;
  }
  jest.mocked(requireOfficeStaff).mockResolvedValue(ctx);
}

function api(
  path: string,
  user: ApiUser,
  init: { method?: string; body?: unknown } = {},
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": user.tenant ?? "org_a",
      "x-dev-role": user.role,
      "x-dev-user": user.id,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const params = <T>(value: T) => ({ params: Promise.resolve(value) });
type ApiUser = { id: string; role: Role; tenant?: string };
type Grant = { companyId: string; workUnitId?: string; area: "safety" | "health" };
const OWNER: ApiUser = { id: X.owner, role: "owner" };
const SCOPED: ApiUser = { id: X.scoped, role: "collaborator" };
const OUTSIDER: ApiUser = { id: "outsider", role: "owner", tenant: "org_b" };

(enabled ? describe : describe.skip)("member access scopes — actions and REST", () => {
  let admin: ReturnType<typeof postgres>;
  const previous = {
    app: process.env.APP_ENV,
    bypass: process.env.DEV_API_AUTH_BYPASS,
  };

  async function grantAs(userId: string, grant: Grant): Promise<string> {
    signIn(X.owner, "owner");
    const result = await grantAccessScopeAction(userId, grant);
    expect(result).toMatchObject({ ok: true });
    return result.ok ? result.data.id : "";
  }

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });
  afterAll(async () => {
    process.env.APP_ENV = previous.app;
    process.env.DEV_API_AUTH_BYPASS = previous.bypass;
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    await seedAccessScopeFixtures(admin);
  });

  it("lets the administrator grant, list and revoke scopes with their audit trail", async () => {
    signIn(X.owner, "owner");
    const granted = await grantAccessScopeAction(X.scoped, {
      companyId: I.companyA,
      workUnitId: I.workUnitA,
      area: "safety",
    });
    expect(granted).toMatchObject({
      ok: true,
      data: {
        userId: X.scoped,
        companyId: I.companyA,
        companyName: "A Ltda",
        workUnitId: I.workUnitA,
        workUnitName: "WU A",
        area: "safety",
        grantedBy: X.owner,
      },
    });
    await grantAccessScopeAction(X.scoped, { companyId: X.companyA2, area: "health" });
    const listed = await listAccessScopesAction(X.scoped);
    expect(listed.ok && listed.data.map((scope) => scope.companyName)).toEqual([
      "A Ltda",
      "A2 Ltda",
    ]);
    expect(listed.ok && listed.data[1]).toMatchObject({
      workUnitId: null,
      workUnitName: null,
      area: "health",
    });
    const scopeId = granted.ok ? granted.data.id : "";
    expect(await revokeAccessScopeAction(X.scoped, scopeId)).toEqual({
      ok: true,
      data: { id: scopeId },
    });
    expect(await revokeAccessScopeAction(X.scoped, scopeId)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    const remaining = await listAccessScopesAction(X.scoped);
    expect(remaining.ok && remaining.data).toHaveLength(1);
  });

  it("rejects invalid, duplicated and out-of-office grants without storing them", async () => {
    signIn(X.owner, "owner");
    const grant: Grant = { companyId: I.companyA, area: "safety" };
    expect((await grantAccessScopeAction(X.scoped, grant)).ok).toBe(true);
    const cases: [string, Grant, string][] = [
      [X.scoped, grant, "DUPLICATE"],
      [X.scoped, { companyId: I.companyB, area: "safety" }, "FK_NOT_FOUND"],
      [
        X.scoped,
        { companyId: X.companyA2, workUnitId: I.workUnitA, area: "safety" },
        "FK_NOT_FOUND",
      ],
      ["not-a-member", grant, "NOT_FOUND"],
      [X.owner, grant, "VALIDATION"],
      [X.clerkAdmin, grant, "VALIDATION"],
    ];
    for (const [userId, input, code] of cases) {
      const result = await grantAccessScopeAction(userId, input);
      expect([userId, input, !result.ok && result.error.code]).toEqual([
        userId,
        input,
        code,
      ]);
    }
    expect(await admin`select id from member_access_scopes`).toHaveLength(1);
  });

  it("keeps grant and revoke with the administrator and lets a member read only its own scopes", async () => {
    const scopeId = await grantAs(X.scoped, { companyId: I.companyA, area: "safety" });
    signIn(X.scoped, "collaborator");
    const forbidden = { ok: false, error: { code: "FORBIDDEN" } };
    expect(
      await grantAccessScopeAction(X.scoped, { companyId: X.companyA2, area: "safety" }),
    ).toMatchObject(forbidden);
    expect(await revokeAccessScopeAction(X.scoped, scopeId)).toMatchObject(forbidden);
    expect(await listAccessScopesAction(X.legacy)).toMatchObject(forbidden);
    const own = await listAccessScopesAction(X.scoped);
    expect(own.ok && own.data).toHaveLength(1);
    expect(await admin`select id from member_access_scopes`).toHaveLength(1);
  });

  it("denies direct access by id and filters lists for a scoped collaborator", async () => {
    signIn(X.scoped, "collaborator");
    expect((await getCompanyAction(X.companyA2)).ok).toBe(true);
    expect((await getPgrAction(X.pgrA2)).ok).toBe(true);

    await grantAs(X.scoped, { companyId: I.companyA, area: "safety" });
    signIn(X.scoped, "collaborator");
    const notFound = { ok: false, error: { code: "NOT_FOUND" } };
    expect(await getCompanyAction(X.companyA2)).toMatchObject(notFound);
    expect(await getPgrAction(X.pgrA2)).toMatchObject(notFound);
    expect(
      await updateCompanyAction(X.companyA2, { razaoSocial: "Tomada", riskGrade: "2" }),
    ).toMatchObject(notFound);
    const [untouched] =
      await admin`select razao_social from companies where id = ${X.companyA2}`;
    expect(untouched.razao_social).toBe("A2 Ltda");

    const companies = await listCompaniesAction();
    expect(companies.ok && companies.data.rows.map((row) => row.id)).toEqual([
      I.companyA,
    ]);
    const pgrs = await listPgrAction();
    expect(pgrs.ok && pgrs.data.total).toBe(3);
    const employees = await listEmployeesAction();
    expect(employees.ok && employees.data.rows.map((row) => row.id)).toEqual([
      I.employeeA,
    ]);
    const workUnits = await listWorkUnitsAction();
    expect(workUnits.ok && workUnits.data.total).toBe(2);
    const exams = await listHealthExamsAction();
    expect(exams.ok && exams.data.total).toBe(0);
    expect((await getCompanyAction(I.companyA)).ok).toBe(true);
    expect((await getPgrAction(I.pgrA)).ok).toBe(true);
  });

  it("applies a change or a revocation to the next request", async () => {
    const first = await grantAs(X.scoped, { companyId: I.companyA, area: "safety" });
    const second = await grantAs(X.scoped, { companyId: X.companyA2, area: "safety" });
    signIn(X.scoped, "collaborator");
    expect((await getCompanyAction(X.companyA2)).ok).toBe(true);

    signIn(X.owner, "owner");
    await revokeAccessScopeAction(X.scoped, second);
    signIn(X.scoped, "collaborator");
    expect((await getCompanyAction(X.companyA2)).ok).toBe(false);
    expect((await getPgrAction(X.pgrA2)).ok).toBe(false);

    signIn(X.owner, "owner");
    await revokeAccessScopeAction(X.scoped, first);
    signIn(X.scoped, "collaborator");
    expect((await getCompanyAction(X.companyA2)).ok).toBe(true);
  });

  it("tells each member which areas the menu may show", async () => {
    signIn(X.legacy, "collaborator");
    expect(await getOwnAccessAreasAction()).toEqual({
      ok: true,
      data: ["safety", "health"],
    });
    await grantAs(X.healthOnly, { companyId: I.companyA, area: "health" });
    signIn(X.healthOnly, "collaborator");
    expect(await getOwnAccessAreasAction()).toEqual({ ok: true, data: ["health"] });
    await grantAs(X.scoped, { companyId: I.companyA, area: "safety" });
    signIn(X.scoped, "collaborator");
    expect(await getOwnAccessAreasAction()).toEqual({ ok: true, data: ["safety"] });
    signIn(X.owner, "owner");
    expect(await getOwnAccessAreasAction()).toEqual({
      ok: true,
      data: ["safety", "health"],
    });
  });

  it("scopes a company representative to several companies", async () => {
    await grantAs(X.representative, { companyId: I.companyA, area: "safety" });
    await grantAs(X.representative, { companyId: X.companyA2, area: "safety" });
    signIn(X.representative, "client");
    const own = await listAccessScopesAction(X.representative);
    expect(own.ok && own.data.map((scope) => scope.companyId)).toEqual([
      I.companyA,
      X.companyA2,
    ]);
    expect(await getOwnAccessAreasAction()).toEqual({ ok: true, data: ["safety"] });
    expect(await listCompaniesAction()).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("enforces the same rules over REST, including direct URLs and the PDF route", async () => {
    const scopesPath = `/api/v1/team/${X.scoped}/access-scopes`;
    const member = params({ userId: X.scoped });
    const created = await grantScope(
      api(scopesPath, OWNER, {
        method: "POST",
        body: { companyId: I.companyA, area: "safety" },
      }),
      member,
    );
    expect(created.status).toBe(201);
    const scope = await created.json();
    expect(scope).toMatchObject({ companyId: I.companyA, grantedBy: X.owner });

    const denied = await grantScope(
      api(scopesPath, SCOPED, {
        method: "POST",
        body: { companyId: X.companyA2, area: "safety" },
      }),
      member,
    );
    expect(denied.status).toBe(403);
    expect(
      (await grantScope(api(scopesPath, OWNER, { method: "POST", body: {} }), member))
        .status,
    ).toBe(422);
    expect((await listScopes(api(scopesPath, SCOPED), member)).status).toBe(200);
    expect(
      (
        await listScopes(
          api(`/api/v1/team/${X.legacy}/access-scopes`, SCOPED),
          params({ userId: X.legacy }),
        )
      ).status,
    ).toBe(403);

    const companyUrl = (id: string) => `/api/v1/companies/${id}`;
    expect(
      (
        await getCompany(
          api(companyUrl(X.companyA2), SCOPED),
          params({ id: X.companyA2 }),
        )
      ).status,
    ).toBe(404);
    expect(
      (await getCompany(api(companyUrl(I.companyA), SCOPED), params({ id: I.companyA })))
        .status,
    ).toBe(200);
    expect(
      (await getCompany(api(companyUrl(X.companyA2), OWNER), params({ id: X.companyA2 })))
        .status,
    ).toBe(200);
    const listed = await (await listCompanies(api("/api/v1/companies", SCOPED))).json();
    expect(listed.rows.map((row: { id: string }) => row.id)).toEqual([I.companyA]);

    const pgrUrl = (id: string) => `/api/v1/pgr/${id}`;
    expect(
      (await getPgr(api(pgrUrl(X.pgrA2), SCOPED), params({ id: X.pgrA2 }))).status,
    ).toBe(404);
    expect(
      (await getPgr(api(pgrUrl(X.pgrA2), OWNER), params({ id: X.pgrA2 }))).status,
    ).toBe(200);
    expect(
      (await getPgrPdf(api(`${pgrUrl(X.pgrA2)}/pdf`, SCOPED), params({ id: X.pgrA2 })))
        .status,
    ).toBe(404);
    expect(
      (await getPgrPdf(api(`${pgrUrl(X.pgrA2)}/pdf`, OWNER), params({ id: X.pgrA2 })))
        .status,
    ).not.toBe(404);

    const revoked = await revokeScope(
      api(`${scopesPath}/${scope.id}`, OWNER, { method: "DELETE" }),
      params({ userId: X.scoped, scopeId: scope.id }),
    );
    expect(revoked.status).toBe(204);
    expect(
      (
        await getCompany(
          api(companyUrl(X.companyA2), SCOPED),
          params({ id: X.companyA2 }),
        )
      ).status,
    ).toBe(200);
  });

  it("keeps another office out of the management endpoints", async () => {
    const scopeId = await grantAs(X.scoped, { companyId: I.companyA, area: "safety" });
    const scopesPath = `/api/v1/team/${X.scoped}/access-scopes`;
    const member = params({ userId: X.scoped });
    expect(await (await listScopes(api(scopesPath, OUTSIDER), member)).json()).toEqual(
      [],
    );
    expect(
      (
        await grantScope(
          api(scopesPath, OUTSIDER, {
            method: "POST",
            body: { companyId: I.companyA, area: "safety" },
          }),
          member,
        )
      ).status,
    ).not.toBe(201);
    expect(
      (
        await revokeScope(
          api(`${scopesPath}/${scopeId}`, OUTSIDER, { method: "DELETE" }),
          params({ userId: X.scoped, scopeId }),
        )
      ).status,
    ).toBe(404);
    expect(await admin`select id from member_access_scopes`).toHaveLength(1);
  });
});
