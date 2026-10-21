import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-tenant-context", () => ({
  requireTenantContext: jest.fn(),
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  listMembershipsByOrg: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
}));
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  appointCompanyAuthorizer,
  authorizeCompanyProfessional,
  decideCompanyRisk,
  riskAuthorizationWorkspace,
} from "@/shared/server/medicine/risk-authorization-core";
import {
  getMedicalRiskInventory,
  registerMedicalRiskSource,
} from "@/shared/server/medicine/risk-source-core";
import { listRiskAuthorizationCompanies } from "@/shared/db/repositories/risk-authorizations";
import {
  appointCompanyAuthorizerAction,
  authorizeCompanyProfessionalAction,
} from "@/shared/server/actions/medicine/risk-authorizations";
import {
  PUT as APPOINT,
  GET as WORKSPACE,
} from "@/app/api/v1/companies/[id]/risk-authorizations/route";
import { PUT as GRANT } from "@/app/api/v1/companies/[id]/risk-authorizations/professionals/route";
import { POST as REVIEW } from "@/app/api/v1/companies/[id]/medical-risks/[entryId]/review/route";
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const owner: TenantContext = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free",
};
const authority: TenantContext = { ...owner, userId: "authorizer", role: "client" };
const professional: TenantContext = { ...owner, userId: "professional", role: "client" };
const identity = {
  fullName: "Profissional fictício",
  profession: "Profissão declarada",
  registration: { kind: "registered", council: "Órgão declarado", number: "123" },
};
const appointment = {
  userId: "authorizer",
  evidence: "Documento indicado pela empresa",
  reason: "Indicação da empresa-cliente",
};
const grant = {
  userId: "professional",
  active: true,
  identity,
  reason: "Autorização específica da empresa",
};
const source = {
  kind: "external",
  title: "PGR externo fictício",
  reference: "GED:referência-fictícia",
  version: "1",
  risks: [
    {
      agentType: "physical",
      description: "Risco fictício",
      exposureGroup: "Grupo fictício",
    },
  ],
};
const decision = {
  status: "validated",
  reason: "Parecer técnico fictício para teste",
  expectedStatus: "pending",
  expectedReviewedAt: null,
};
const request = (ctx: TenantContext, method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/v1/company/risk-authorizations", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("company-designated risk authorization", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
    await applyMigrations(admin);
    runtime = (await import("postgres")).default(
      process.env.INTEGRATION_APP_RUNTIME_URL!,
      { max: 1, prepare: false },
    );
  });
  afterAll(async () => {
    process.env = originalEnv;
    await runtime?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    await seedPgrBase(admin);
    await admin`insert into users (id,email) values ('owner','owner@example.test'),('authorizer','authorizer@example.test'),('replacement','replacement@example.test'),('professional','professional@example.test'),('stranger','stranger@example.test'),('other-tenant','other@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role,scoped_company_id) values ('org_a','owner','owner',null),('org_a','authorizer','client',${I.companyA}),('org_a','replacement','client',${I.companyA}),('org_a','professional','client',${I.companyA}),('org_a','stranger','collaborator',null),('org_b','other-tenant','owner',null)`;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireTenantContext as jest.Mock).mockResolvedValue(owner);
    (requireOfficeStaff as jest.Mock).mockResolvedValue(owner);
  });
  async function authorize() {
    await appointCompanyAuthorizer(owner, I.companyA, appointment);
    await authorizeCompanyProfessional(authority, I.companyA, grant);
  }
  async function risk() {
    const registered = await registerMedicalRiskSource(owner, I.companyA, source);
    const [entry] =
      await admin`select id from medical_risk_entries where source_id=${registered.id}`;
    return entry.id as string;
  }

  it("owner records the company's nomination but does not gain professional powers", async () => {
    const entryId = await risk();
    await expect(
      authorizeCompanyProfessional(owner, I.companyA, grant),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await appointCompanyAuthorizer(owner, I.companyA, appointment);
    await expect(
      decideCompanyRisk(owner, I.companyA, entryId, decision),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const view = await riskAuthorizationWorkspace(owner, I.companyA);
    expect(view.canAppoint).toBe(true);
    expect(view.canAuthorize).toBe(false);
    expect(view.canReview).toBe(false);
    expect(view.history.rows[0].details.next).toMatchObject({
      evidence: appointment.evidence,
    });
  });
  it("uses the designated client's own login for authorizations and tracks validation identity", async () => {
    await authorize();
    const entryId = await risk();
    const reviewed = await decideCompanyRisk(professional, I.companyA, entryId, decision);
    expect(reviewed.reviewerId).toBe(professional.userId);
    expect(reviewed.identity).toEqual(identity);
    expect(reviewed.reviewedAt).toBeInstanceOf(Date);
    const inventory = await getMedicalRiskInventory(professional, I.companyA);
    expect(inventory.validationAvailable).toBe(true);
    expect(inventory.rows[0].risks[0].usableForPcmso).toBe(true);
    expect(
      (await listRiskAuthorizationCompanies(professional)).rows.map((c) => c.id),
    ).toEqual([I.companyA]);
  });
  it("replaces the authorizer immediately without rewriting existing grants or decisions", async () => {
    await authorize();
    const entryId = await risk();
    await decideCompanyRisk(professional, I.companyA, entryId, decision);
    await appointCompanyAuthorizer(owner, I.companyA, {
      ...appointment,
      userId: "replacement",
      reason: "Nova indicação",
    });
    await expect(
      authorizeCompanyProfessional(authority, I.companyA, {
        active: false,
        userId: "professional",
        reason: "Não autorizado",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await authorizeCompanyProfessional(
      { ...authority, userId: "replacement" },
      I.companyA,
      { active: false, userId: "professional", reason: "Revogação expressa" },
    );
    await expect(
      decideCompanyRisk(professional, I.companyA, entryId, {
        ...decision,
        status: "rejected",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const view = await riskAuthorizationWorkspace(owner, I.companyA);
    expect(view.reviews.rows[0].identity).toEqual(identity);
    expect(view.professionals[0].active).toBe(false);
    expect(
      (await admin`select status from medical_risk_entries where id=${entryId}`)[0]
        .status,
    ).toBe("validated");
  });
  it("cannot nominate an account from another tenant or operate on another company", async () => {
    await expect(
      appointCompanyAuthorizer(owner, I.companyA, {
        ...appointment,
        userId: "other-tenant",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await authorize();
    await expect(
      authorizeCompanyProfessional(authority, I.companyB, grant),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [company] =
      await admin`insert into companies (org_id,razao_social) values ('org_a','Outra empresa') returning id`;
    await expect(
      authorizeCompanyProfessional(authority, company.id, grant),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      riskAuthorizationWorkspace(
        { ...owner, userId: "stranger", role: "collaborator" },
        I.companyA,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("records a rejection and detects conflicting review submissions", async () => {
    await authorize();
    const entryId = await risk();
    await decideCompanyRisk(professional, I.companyA, entryId, {
      ...decision,
      status: "rejected",
    });
    await expect(
      decideCompanyRisk(professional, I.companyA, entryId, decision),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const inventory = await getMedicalRiskInventory(professional, I.companyA);
    expect(inventory.rows[0].risks[0].usableForPcmso).toBe(false);
    expect(
      (await admin`select id from medical_risk_decisions where entry_id=${entryId}`)
        .length,
    ).toBe(1);
  });
  it("serializes concurrent decisions so only one can consume the pending state", async () => {
    await authorize();
    const entryId = await risk();
    const attempts = await Promise.allSettled([
      decideCompanyRisk(professional, I.companyA, entryId, decision),
      decideCompanyRisk(professional, I.companyA, entryId, {
        ...decision,
        status: "rejected",
      }),
    ]);
    expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((x) => x.status === "rejected")).toHaveLength(1);
  });
  it("blocks validation of superseded or changed internal sources and disabled Medicine", async () => {
    await authorize();
    const internal = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    const [entry] =
      await admin`select id from medical_risk_entries where source_id=${internal.id}`;
    await admin`update risks set description='Atualizado depois da captura' where id=${I.riskA}`;
    await expect(
      decideCompanyRisk(professional, I.companyA, entry.id, decision),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const external = await registerMedicalRiskSource(owner, I.companyA, source);
    const [oldEntry] =
      await admin`select id from medical_risk_entries where source_id=${external.id}`;
    await registerMedicalRiskSource(owner, I.companyA, {
      ...source,
      version: "2",
      supersedesSourceId: external.id,
    });
    await expect(
      decideCompanyRisk(professional, I.companyA, oldEntry.id, decision),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    await expect(
      decideCompanyRisk(professional, I.companyA, oldEntry.id, decision),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rolls back authorizations and review state when the corresponding audit insert fails", async () => {
    await appointCompanyAuthorizer(owner, I.companyA, appointment);
    await admin`revoke insert on risk_authorization_events from app_runtime`;
    try {
      await expect(
        authorizeCompanyProfessional(authority, I.companyA, grant),
      ).rejects.toBeDefined();
      expect(await admin`select id from professional_risk_authorizations`).toHaveLength(
        0,
      );
    } finally {
      await admin`grant insert on risk_authorization_events to app_runtime`;
    }
    await authorizeCompanyProfessional(authority, I.companyA, grant);
    const entryId = await risk();
    await admin`revoke insert on medical_risk_decisions from app_runtime`;
    try {
      await expect(
        decideCompanyRisk(professional, I.companyA, entryId, decision),
      ).rejects.toBeDefined();
      expect(
        (await admin`select status from medical_risk_entries where id=${entryId}`)[0]
          .status,
      ).toBe("pending");
    } finally {
      await admin`grant insert on medical_risk_decisions to app_runtime`;
    }
  });
  it("preserves decisions after professional profile changes and membership removal", async () => {
    await authorize();
    const entryId = await risk();
    await decideCompanyRisk(professional, I.companyA, entryId, decision);
    await authorizeCompanyProfessional(authority, I.companyA, {
      ...grant,
      identity: { ...identity, fullName: "Nome atualizado" },
    });
    await admin`delete from org_memberships where org_id='org_a' and user_id='professional'`;
    expect(
      await admin`select id from professional_risk_authorizations where user_id='professional'`,
    ).toHaveLength(0);
    expect(
      (
        await admin`select identity from medical_risk_decisions where entry_id=${entryId}`
      )[0].identity.fullName,
    ).toBe(identity.fullName);
  });
  it("enforces delegated HTTP access, JSON validation, and production session authentication", async () => {
    const params = { params: Promise.resolve({ id: I.companyA }) };
    expect((await APPOINT(request(authority, "PUT", appointment), params)).status).toBe(
      403,
    );
    expect((await APPOINT(request(owner, "PUT", appointment), params)).status).toBe(200);
    expect((await GRANT(request(authority, "PUT", grant), params)).status).toBe(200);
    expect((await WORKSPACE(request(professional, "GET"), params)).status).toBe(200);
    const entryId = await risk();
    expect(
      (
        await REVIEW(request(professional, "POST", decision), {
          params: Promise.resolve({ id: I.companyA, entryId }),
        })
      ).status,
    ).toBe(201);
    const invalid = new NextRequest("http://localhost/api", {
      method: "PUT",
      body: "{",
      headers: { "x-dev-tenant": "org_a", "x-dev-user": "owner", "x-dev-role": "owner" },
    });
    expect((await APPOINT(invalid, params)).status).toBe(422);
    process.env.APP_ENV = "production";
    (requireTenantContext as jest.Mock).mockResolvedValue(authority);
    expect((await APPOINT(request(owner, "PUT", appointment), params)).status).toBe(403);
  });
  it("keeps the existing staff gate default and enables delegated Server Actions explicitly", async () => {
    (requireTenantContext as jest.Mock).mockResolvedValue(owner);
    expect((await appointCompanyAuthorizerAction(I.companyA, appointment)).ok).toBe(true);
    (requireTenantContext as jest.Mock).mockResolvedValue(authority);
    expect((await authorizeCompanyProfessionalAction(I.companyA, grant)).ok).toBe(true);
    expect(requireOfficeStaff).not.toHaveBeenCalled();
  });
  it("denies SQL changes to imported content, immutable history and foreign tenant data", async () => {
    await authorize();
    const entryId = await risk();
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) => tx`update medical_risk_entries set content='{}' where id=${entryId}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      withOrgTx(runtime, "org_a", (tx) => tx`delete from risk_authorization_events`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) => tx`update medical_risk_decisions set reason='forged'`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      await withOrgTx(
        runtime,
        "org_b",
        (tx) => tx`select id from professional_risk_authorizations`,
      ),
    ).toHaveLength(0);
  });
});
