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
  listMembershipsByOrg: jest.fn(),
}));
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { listMembershipsByOrg } from "@/shared/db/repositories/org-memberships";
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
import { liveMedicalRiskBasisTx } from "@/shared/db/repositories/medical-risk-basis";
import { withOrg } from "@/shared/db/with-org";
import { appointCompanyAuthorizerAction } from "@/shared/server/actions/medicine/risk-authorizations";
import { PUT as APPOINT } from "@/app/api/v1/companies/[id]/risk-authorizations/route";
import {
  adminClient,
  appRuntimeClient,
  applyMigrations,
  withOrgTx,
} from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const SECOND_COMPANY = "33333333-3333-3333-3333-333333333333";
const THIRD_COMPANY = "44444444-4444-4444-4444-444444444444";
const owner: TenantContext = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free",
};
const client = (userId: string): TenantContext => ({ ...owner, userId, role: "client" });
const representative = client("representative");
const multiCompany = client("multi-representative");
const authority = client("authorizer");
const professional = client("professional");
const identity = {
  fullName: "Profissional fictício",
  profession: "Profissão declarada",
  registration: { kind: "registered", council: "Órgão declarado", number: "123" },
};
const appointment = {
  userId: "authorizer",
  evidence: "Ata fictícia de indicação da empresa",
  reason: "Indicação feita pela própria empresa",
};
const grant = {
  userId: "professional",
  active: true,
  identity,
  reason: "Autorização específica da empresa",
};
const externalSource = {
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
const request = (ctx: TenantContext, body: unknown) =>
  new NextRequest("http://localhost/api/v1/company/risk-authorizations", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)(
  "company representative appoints the authorizer and changed risks return to review",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;
    const originalEnv = { ...process.env };
    beforeAll(async () => {
      admin = adminClient();
      await admin`set client_min_messages = warning`;
      await applyMigrations(admin);
      runtime = appRuntimeClient();
    });
    afterAll(async () => {
      process.env = originalEnv;
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });
    beforeEach(async () => {
      jest.clearAllMocks();
      await seedPgrBase(admin);
      await admin`insert into companies (id,org_id,razao_social) values (${SECOND_COMPANY},'org_a','Segunda empresa'),(${THIRD_COMPANY},'org_a','Terceira empresa')`;
      await admin`insert into users (id,email) values ('owner','owner@example.test'),('representative','rep@example.test'),('multi-representative','multi@example.test'),('unbound','unbound@example.test'),('authorizer','authorizer@example.test'),('professional','professional@example.test'),('staff','staff@example.test'),('other-representative','other@example.test')`;
      await admin`insert into org_memberships (org_id,user_id,role,scoped_company_id) values ('org_a','owner','owner',null),('org_a','representative','client',${I.companyA}),('org_a','multi-representative','org:client',null),('org_a','unbound','client',null),('org_a','authorizer','client',${I.companyA}),('org_a','professional','client',${I.companyA}),('org_a','staff','collaborator',null),('org_b','other-representative','client',${I.companyB})`;
      await admin`insert into member_access_scopes (org_id,user_id,company_id,area,granted_by) values ('org_a','multi-representative',${I.companyA},'health','owner'),('org_a','multi-representative',${SECOND_COMPANY},'health','owner')`;
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
      jest.mocked(listMembershipsByOrg).mockResolvedValue({ rows: [], total: 0 });
      jest.mocked(requireTenantContext).mockResolvedValue(representative);
      jest.mocked(requireOfficeStaff).mockResolvedValue(owner);
    });
    const asActor = <T>(
      userId: string,
      run: (tx: ReturnType<typeof postgres>) => Promise<T>,
    ) =>
      withOrgTx(runtime, "org_a", async (tx) => {
        await tx`select set_config('app.current_actor', ${userId}, true)`;
        return run(tx);
      });
    async function entryOf(sourceId: string) {
      const [entry] =
        await admin`select id from medical_risk_entries where source_id=${sourceId}`;
      return String(entry.id);
    }
    async function authorizeProfessional() {
      await appointCompanyAuthorizer(representative, I.companyA, appointment);
      await authorizeCompanyProfessional(authority, I.companyA, grant);
    }
    const usableRiskIds = () =>
      withOrg("org_a", async (tx) => {
        const basis = await liveMedicalRiskBasisTx(tx, "org_a", I.companyA);
        return basis.riskIds;
      });

    it("lets the representative appoint in the own company and keeps the evidence in the audit trail", async () => {
      await appointCompanyAuthorizer(representative, I.companyA, appointment);
      const [row] =
        await admin`select user_id,recorded_by,evidence from company_risk_authorizers where company_id=${I.companyA}`;
      expect(row).toMatchObject({
        user_id: "authorizer",
        recorded_by: "representative",
        evidence: appointment.evidence,
      });
      const view = await riskAuthorizationWorkspace(representative, I.companyA);
      expect(view).toMatchObject({
        canAppoint: true,
        canAuthorize: false,
        canReview: false,
        appointmentOrigin: "company_representative",
      });
      expect(view.history.rows[0]).toMatchObject({
        actor: "representative",
        subjectUserId: "authorizer",
        event: "authorizer_appointed",
      });
      expect(view.history.rows[0].createdAt).toBeInstanceOf(Date);
      expect(view.history.rows[0].details).toMatchObject({
        origin: "company_representative",
        next: { evidence: appointment.evidence, reason: appointment.reason },
      });
      const ownerView = await riskAuthorizationWorkspace(owner, I.companyA);
      expect(ownerView.appointmentOrigin).toBe("office_owner");
      expect(ownerView.history.rows[0].details).toMatchObject({
        origin: "company_representative",
      });
      await appointCompanyAuthorizer(owner, I.companyA, appointment);
      const afterOwner = await riskAuthorizationWorkspace(owner, I.companyA);
      expect(afterOwner.history.rows[0].details).toMatchObject({
        origin: "office_owner",
      });
      expect(afterOwner.history.total).toBe(2);
      expect(
        (await listRiskAuthorizationCompanies(representative)).rows.map((c) => c.id),
      ).toEqual([I.companyA]);
    });

    it("denies the representative in another company of the same office", async () => {
      await expect(
        appointCompanyAuthorizer(representative, SECOND_COMPANY, {
          ...appointment,
          userId: "multi-representative",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        riskAuthorizationWorkspace(representative, SECOND_COMPANY),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        appointCompanyAuthorizer(client("unbound"), I.companyA, appointment),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        appointCompanyAuthorizer(
          { ...owner, userId: "staff", role: "collaborator" },
          I.companyA,
          appointment,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await admin`select id from company_risk_authorizers`).toHaveLength(0);
      expect(await admin`select id from risk_authorization_events`).toHaveLength(0);
    });

    it("scopes a multi-company representative to the companies granted by access scope", async () => {
      await appointCompanyAuthorizer(multiCompany, I.companyA, appointment);
      await appointCompanyAuthorizer(multiCompany, SECOND_COMPANY, {
        ...appointment,
        userId: "owner",
      });
      await expect(
        appointCompanyAuthorizer(multiCompany, THIRD_COMPANY, {
          ...appointment,
          userId: "owner",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const companies = (await listRiskAuthorizationCompanies(multiCompany)).rows.map(
        (c) => c.id,
      );
      expect([...companies].sort()).toEqual([I.companyA, SECOND_COMPANY].sort());
      await admin`delete from member_access_scopes where user_id='multi-representative' and company_id=${SECOND_COMPANY}`;
      await expect(
        appointCompanyAuthorizer(multiCompany, SECOND_COMPANY, {
          ...appointment,
          userId: "owner",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("blocks self-granting by the representative, the authorizer and the professional", async () => {
      const source = await registerMedicalRiskSource(owner, I.companyA, externalSource);
      const entryId = await entryOf(source.id);
      await expect(
        appointCompanyAuthorizer(representative, I.companyA, {
          ...appointment,
          userId: "representative",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await authorizeProfessional();
      await expect(
        authorizeCompanyProfessional(representative, I.companyA, {
          ...grant,
          userId: "representative",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        decideCompanyRisk(representative, I.companyA, entryId, decision),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        appointCompanyAuthorizer(authority, I.companyA, {
          ...appointment,
          userId: "professional",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        appointCompanyAuthorizer(professional, I.companyA, {
          ...appointment,
          userId: "professional",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        appointCompanyAuthorizer(professional, I.companyA, {
          ...appointment,
          userId: "representative",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const [row] =
        await admin`select user_id,recorded_by from company_risk_authorizers where company_id=${I.companyA}`;
      expect(row).toMatchObject({ user_id: "authorizer", recorded_by: "representative" });
    });

    it("rejects acting on behalf of another account in the input and in direct SQL", async () => {
      await expect(
        appointCompanyAuthorizer(representative, I.companyA, {
          ...appointment,
          recordedBy: "owner",
        }),
      ).rejects.toMatchObject({ name: "ZodError" });
      const insertAs = (actor: string, recordedBy: string, userId: string) =>
        asActor(
          actor,
          (tx) =>
            tx`insert into company_risk_authorizers (org_id,company_id,user_id,evidence,reason,recorded_by) values ('org_a',${I.companyA},${userId},'e','r',${recordedBy})`,
        );
      await expect(
        insertAs("representative", "owner", "authorizer"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        insertAs("representative", "representative", "representative"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(insertAs("unbound", "unbound", "authorizer")).rejects.toMatchObject({
        code: "42501",
      });
      await expect(insertAs("staff", "staff", "authorizer")).rejects.toMatchObject({
        code: "42501",
      });
      await expect(
        asActor(
          "representative",
          (tx) =>
            tx`insert into company_risk_authorizers (org_id,company_id,user_id,evidence,reason,recorded_by) values ('org_a',${SECOND_COMPANY},'owner','e','r','representative')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asActor(
          "representative",
          (tx) =>
            tx`insert into risk_authorization_events (org_id,company_id,actor,event,details) values ('org_a',${I.companyA},'owner','authorizer_appointed','{}')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await insertAs("representative", "representative", "authorizer");
      await authorizeCompanyProfessional(authority, I.companyA, grant);
      const updateAs = (actor: string, userId: string) =>
        asActor(
          actor,
          (tx) =>
            tx`update company_risk_authorizers set user_id=${userId}, recorded_by=${actor} where company_id=${I.companyA} returning id`,
        );
      expect(await updateAs("authorizer", "professional")).toHaveLength(0);
      expect(await updateAs("professional", "representative")).toHaveLength(0);
      expect(await updateAs("representative", "professional")).toHaveLength(1);
    });

    it("isolates offices: a representative of another office reaches nothing here", async () => {
      await expect(
        appointCompanyAuthorizer(
          { ...client("other-representative"), tenantId: "org_b" },
          I.companyA,
          appointment,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        appointCompanyAuthorizer(client("other-representative"), I.companyA, appointment),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        appointCompanyAuthorizer(representative, I.companyA, {
          ...appointment,
          userId: "other-representative",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await appointCompanyAuthorizer(representative, I.companyA, appointment);
      expect(
        await withOrgTx(runtime, "org_b", async (tx) => {
          await tx`select set_config('app.current_actor', 'other-representative', true)`;
          return tx`select id from company_risk_authorizers`;
        }),
      ).toHaveLength(0);
    });

    it("applies revocation of the appointment, of the representative and of the professional", async () => {
      await authorizeProfessional();
      const source = await registerMedicalRiskSource(owner, I.companyA, externalSource);
      const entryId = await entryOf(source.id);
      const reviewed = await decideCompanyRisk(
        professional,
        I.companyA,
        entryId,
        decision,
      );
      await appointCompanyAuthorizer(representative, I.companyA, {
        userId: null,
        evidence: "Comunicado fictício de revogação",
        reason: "Empresa retirou a indicação",
      });
      await expect(
        authorizeCompanyProfessional(authority, I.companyA, {
          userId: "professional",
          active: false,
          reason: "Tentativa após a revogação",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const afterRevocation = await riskAuthorizationWorkspace(owner, I.companyA);
      expect(afterRevocation.history.rows[0]).toMatchObject({
        event: "authorizer_revoked",
        actor: "representative",
      });
      expect(afterRevocation.history.rows[0].details).toMatchObject({
        origin: "company_representative",
      });
      await appointCompanyAuthorizer(representative, I.companyA, appointment);
      await authorizeCompanyProfessional(authority, I.companyA, {
        userId: "professional",
        active: false,
        reason: "Revogação expressa",
      });
      await expect(
        decideCompanyRisk(professional, I.companyA, entryId, {
          status: "rejected",
          reason: "Tentativa após a revogação",
          expectedStatus: "validated",
          expectedReviewedAt: reviewed.reviewedAt.toISOString(),
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const preserved = await riskAuthorizationWorkspace(owner, I.companyA);
      expect(preserved.reviews.rows.map((row) => row.id)).toEqual([reviewed.id]);
      expect(preserved.reviews.rows[0]).toMatchObject({
        reviewerId: "professional",
        identity,
        status: "validated",
      });
      expect(await usableRiskIds()).toEqual([entryId]);
      await admin`update org_memberships set scoped_company_id=${SECOND_COMPANY} where org_id='org_a' and user_id='representative'`;
      await expect(
        appointCompanyAuthorizer(representative, I.companyA, appointment),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await admin`delete from org_memberships where org_id='org_a' and user_id='representative'`;
      await expect(
        appointCompanyAuthorizer(representative, SECOND_COMPANY, {
          ...appointment,
          userId: "owner",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("sends a changed internal risk back to review, removes it from Medicine and keeps the opinion", async () => {
      await authorizeProfessional();
      const source = await registerMedicalRiskSource(owner, I.companyA, {
        kind: "internal",
        pgrId: I.pgrA,
      });
      const entryId = await entryOf(source.id);
      const pending = await getMedicalRiskInventory(owner, I.companyA);
      expect(pending.rows[0].risks[0]).toMatchObject({
        status: "pending",
        usableForPcmso: false,
      });
      expect(await usableRiskIds()).toEqual([]);
      const reviewed = await decideCompanyRisk(
        professional,
        I.companyA,
        entryId,
        decision,
      );
      expect(await usableRiskIds()).toEqual([entryId]);
      await admin`update risks set description='Alterado depois da validação' where id=${I.riskA}`;
      const changed = await getMedicalRiskInventory(owner, I.companyA);
      expect(changed.rows[0]).toMatchObject({
        id: source.id,
        freshness: "changed",
        status: "origin_changed",
      });
      expect(changed.rows[0].warnings).toContain(
        "O PGR de origem mudou. Registre uma nova versão e solicite revisão.",
      );
      expect(changed.rows[0].risks[0]).toMatchObject({
        id: entryId,
        status: "validated",
        usableForPcmso: false,
        reviewedBy: "professional",
      });
      expect(await usableRiskIds()).toEqual([]);
      await expect(
        decideCompanyRisk(professional, I.companyA, entryId, {
          ...decision,
          expectedStatus: "validated",
          expectedReviewedAt: reviewed.reviewedAt.toISOString(),
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const next = await registerMedicalRiskSource(owner, I.companyA, {
        kind: "internal",
        pgrId: I.pgrA,
        supersedesSourceId: source.id,
      });
      const nextEntryId = await entryOf(next.id);
      const inventory = await getMedicalRiskInventory(owner, I.companyA);
      const current = inventory.rows.find((row) => row.id === next.id);
      const previous = inventory.rows.find((row) => row.id === source.id);
      expect(current).toMatchObject({
        freshness: "current",
        status: "awaiting_validation",
      });
      expect(current?.risks[0]).toMatchObject({
        id: nextEntryId,
        status: "pending",
        usableForPcmso: false,
        reviewedBy: null,
      });
      expect(previous).toMatchObject({ freshness: "superseded", status: "superseded" });
      expect(previous?.risks[0]).toMatchObject({
        status: "validated",
        usableForPcmso: false,
        reviewNote: decision.reason,
      });
      expect(await usableRiskIds()).toEqual([]);
      const history = await riskAuthorizationWorkspace(owner, I.companyA);
      expect(history.reviews.rows.map((row) => row.id)).toEqual([reviewed.id]);
      expect(history.reviews.rows[0]).toMatchObject({
        entryId,
        sourceFingerprint: source.fingerprint,
        reason: decision.reason,
      });
      await decideCompanyRisk(professional, I.companyA, nextEntryId, decision);
      expect(await usableRiskIds()).toEqual([nextEntryId]);
      const after = await riskAuthorizationWorkspace(owner, I.companyA);
      expect(after.reviews.total).toBe(2);
    });

    it("sends a new version of an external source back to review and keeps the previous opinion", async () => {
      await authorizeProfessional();
      const source = await registerMedicalRiskSource(owner, I.companyA, externalSource);
      const entryId = await entryOf(source.id);
      const reviewed = await decideCompanyRisk(
        professional,
        I.companyA,
        entryId,
        decision,
      );
      expect(await usableRiskIds()).toEqual([entryId]);
      const next = await registerMedicalRiskSource(owner, I.companyA, {
        ...externalSource,
        version: "2",
        risks: [{ ...externalSource.risks[0], description: "Risco fictício revisado" }],
        supersedesSourceId: source.id,
      });
      const inventory = await getMedicalRiskInventory(owner, I.companyA);
      const current = inventory.rows.find((row) => row.id === next.id);
      const previous = inventory.rows.find((row) => row.id === source.id);
      expect(current?.risks[0]).toMatchObject({
        status: "pending",
        usableForPcmso: false,
      });
      expect(previous?.risks[0]).toMatchObject({
        status: "validated",
        usableForPcmso: false,
      });
      expect(await usableRiskIds()).toEqual([]);
      const [kept] =
        await admin`select reviewer_id,status,reason from medical_risk_decisions where id=${reviewed.id}`;
      expect(kept).toMatchObject({
        reviewer_id: "professional",
        status: "validated",
        reason: decision.reason,
      });
    });

    it("keeps the inventory contract that Medicine consumes", async () => {
      await authorizeProfessional();
      const source = await registerMedicalRiskSource(owner, I.companyA, externalSource);
      await decideCompanyRisk(
        professional,
        I.companyA,
        await entryOf(source.id),
        decision,
      );
      const inventory = await getMedicalRiskInventory(owner, I.companyA);
      expect(Object.keys(inventory)).toEqual(
        expect.arrayContaining([
          "rows",
          "total",
          "validationAvailable",
          "validationNotice",
        ]),
      );
      expect(Object.keys(inventory.rows[0])).toEqual(
        expect.arrayContaining([
          "id",
          "companyId",
          "kind",
          "title",
          "version",
          "reference",
          "documentDate",
          "preparedBy",
          "reviewDueOn",
          "originPgrId",
          "originRevision",
          "fingerprint",
          "supersedesSourceId",
          "registeredBy",
          "registeredAt",
          "superseded",
          "freshness",
          "status",
          "warnings",
          "risks",
        ]),
      );
      expect(Object.keys(inventory.rows[0].risks[0])).toEqual(
        expect.arrayContaining([
          "id",
          "sourceId",
          "content",
          "status",
          "reviewedBy",
          "reviewedAt",
          "reviewNote",
          "usableForPcmso",
        ]),
      );
      expect(inventory.rows[0]).toMatchObject({
        freshness: "external_reference",
        status: "validated",
      });
      expect(inventory.rows[0].risks[0]).toMatchObject({
        status: "validated",
        usableForPcmso: true,
      });
      const basis = await withOrg("org_a", (tx) =>
        liveMedicalRiskBasisTx(tx, "org_a", I.companyA),
      );
      expect(Object.keys(basis).sort()).toEqual(["fresh", "riskIds", "risks", "sources"]);
      expect(basis.sources).toEqual([{ id: source.id, version: "1" }]);
      expect(basis.risks).toEqual([
        {
          exposureGroup: "Grupo fictício",
          jobRole: "",
          description: "Risco fictício",
          agentType: "physical",
          possibleInjuries: null,
        },
      ]);
    });

    it("serves the representative through the delegated Server Action and REST without the office gate", async () => {
      const params = { params: Promise.resolve({ id: I.companyA }) };
      const other = { params: Promise.resolve({ id: SECOND_COMPANY }) };
      expect((await APPOINT(request(representative, appointment), params)).status).toBe(
        200,
      );
      expect((await APPOINT(request(representative, appointment), other)).status).toBe(
        403,
      );
      expect(
        (
          await APPOINT(
            request(representative, { ...appointment, userId: "representative" }),
            params,
          )
        ).status,
      ).toBe(403);
      expect(await appointCompanyAuthorizerAction(I.companyA, appointment)).toMatchObject(
        { ok: true },
      );
      expect(
        await appointCompanyAuthorizerAction(SECOND_COMPANY, appointment),
      ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(requireOfficeStaff).not.toHaveBeenCalled();
    });
  },
);
