import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
}));
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  getMedicalRiskInventoryAction,
  registerMedicalRiskSourceAction,
} from "@/shared/server/actions/medicine/risk-sources";
import { GET, POST } from "@/app/api/v1/companies/[id]/medical-risk-sources/route";
import { adminClient, applyMigrations, withOrgTx } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import type { MedicalSourceInput } from "@/shared/domains/medicine/risk-sources";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const external: MedicalSourceInput = {
  kind: "external",
  title: "PGR de referência",
  reference: "GED:documento-exemplo",
  version: "1",
  risks: [
    {
      agentType: "physical",
      description: "Ruído externo",
      exposureGroup: "Produção",
      jobRole: "Operador",
    },
  ],
};
const gate = (tenantId = "org_a") =>
  (requireOfficeStaff as jest.Mock).mockResolvedValue({
    userId: "registrador",
    tenantId,
    role: "owner",
    plan: "free",
  });

(enabled ? describe : describe.skip)("medical risk sources", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    const factory = (await import("postgres")).default;
    runtime = factory(process.env.INTEGRATION_APP_RUNTIME_URL!, {
      max: 1,
      prepare: false,
    });
  });
  afterAll(async () => {
    await runtime?.end({ timeout: 5 });
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    gate();
  });

  it("lets Medicine-only register and consult external risks without a PCMSO or PGR purchase", async () => {
    await admin`update company_modules set enabled = false where company_id = ${I.companyA} and module='pgr'`;
    const created = await registerMedicalRiskSourceAction(I.companyA, external);
    expect(created.ok).toBe(true);
    const result = await getMedicalRiskInventoryAction(I.companyA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const source = result.data.rows[0];
    expect(source).toMatchObject({
      kind: "external",
      reference: external.reference,
      version: "1",
      registeredBy: "registrador",
      freshness: "external_reference",
    });
    expect(source.risks[0]).toMatchObject({
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      usableForPcmso: false,
    });
    expect(source.risks[0].content).toMatchObject({
      exposureGroup: "Produção",
      jobRole: "Operador",
    });
    expect(result.data.validationAvailable).toBe(false);
    expect(
      await admin`select * from medical_risk_events where actor='registrador'`,
    ).toHaveLength(1);
  });
  it("rejects automatic imported approval and enforces pending inserts in RLS", async () => {
    const bad = {
      ...external,
      risks: [
        {
          ...(external.kind === "external" ? external.risks[0] : {}),
          status: "validated",
          reviewedBy: "forged",
        },
      ],
    };
    const result = await registerMedicalRiskSourceAction(
      I.companyA,
      bad as MedicalSourceInput,
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION");
    const created = await registerMedicalRiskSourceAction(I.companyA, external);
    if (!created.ok) throw new Error("fixture registration failed");
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) =>
          tx`insert into medical_risk_entries (org_id,company_id,source_id,content,status,reviewed_by,reviewed_at) values ('org_a',${I.companyA},${created.data.id},'{}','validated','forged',now())`,
      ),
    ).rejects.toThrow();
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) =>
          tx`update medical_risk_entries set status='validated',reviewed_by='forged',reviewed_at=now()`,
      ),
    ).rejects.toThrow();
  });
  it("captures internal provenance and detects edits even without a new revision", async () => {
    const created = await registerMedicalRiskSourceAction(I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    expect(created.ok).toBe(true);
    const current = await getMedicalRiskInventoryAction(I.companyA);
    if (!current.ok) throw new Error("read failed");
    expect(current.data.rows[0]).toMatchObject({
      freshness: "current",
      originPgrId: I.pgrA,
      originRevision: 1,
    });
    expect(current.data.rows[0].risks[0].content).toMatchObject({
      originRiskId: I.riskA,
      originGesId: I.gesA,
      description: "Ruído contínuo",
    });
    await admin`update risks set description='Inventário atualizado' where id=${I.riskA}`;
    const changed = await getMedicalRiskInventoryAction(I.companyA);
    if (!changed.ok) throw new Error("read failed");
    expect(changed.data.rows[0].freshness).toBe("changed");
    expect(changed.data.rows[0].risks[0].content.description).toBe("Ruído contínuo");
  });
  it("detects assessment changes and keeps missing origin visible", async () => {
    await registerMedicalRiskSourceAction(I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    await admin`update risk_assessments set probability=4,risk_level=12 where id=${I.riskAssessmentA}`;
    const changed = await getMedicalRiskInventoryAction(I.companyA);
    expect(changed.ok && changed.data.rows[0].freshness).toBe("changed");
    await admin`delete from pgr where id=${I.pgrA}`;
    const missing = await getMedicalRiskInventoryAction(I.companyA);
    expect(missing.ok && missing.data.rows[0].freshness).toBe("unavailable");
    expect(missing.ok && missing.data.rows[0].risks.length).toBe(1);
  });
  it("registers replacement versions without overwriting history", async () => {
    const old = await registerMedicalRiskSourceAction(I.companyA, external);
    if (!old.ok) throw new Error("fixture failed");
    const next = await registerMedicalRiskSourceAction(I.companyA, {
      ...external,
      version: "2",
      supersedesSourceId: old.data.id,
    });
    expect(next.ok).toBe(true);
    const result = await getMedicalRiskInventoryAction(I.companyA);
    if (!result.ok) throw new Error("read failed");
    expect(result.data.total).toBe(2);
    expect(result.data.rows.find((row) => row.id === old.data.id)?.freshness).toBe(
      "superseded",
    );
    const duplicate = await registerMedicalRiskSourceAction(I.companyA, external);
    expect(!duplicate.ok && duplicate.error.code).toBe("DUPLICATE");
  });
  it("rejects source/tenant mismatches and module revocation", async () => {
    const invalid = await registerMedicalRiskSourceAction(I.companyA, {
      kind: "internal",
      pgrId: I.pgrB,
    });
    expect(!invalid.ok && invalid.error.code).toBe("NOT_FOUND");
    gate("org_b");
    const other = await registerMedicalRiskSourceAction(I.companyB, external);
    if (!other.ok) throw new Error("fixture failed");
    gate();
    const mismatch = await registerMedicalRiskSourceAction(I.companyA, {
      ...external,
      version: "2",
      supersedesSourceId: other.data.id,
    });
    expect(!mismatch.ok && mismatch.error.code).toBe("FK_NOT_FOUND");
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    const denied = await getMedicalRiskInventoryAction(I.companyA);
    expect(!denied.ok && denied.error.code).toBe("FORBIDDEN");
    expect(
      await withOrgTx(runtime, "org_a", (tx) => tx`select * from medical_risk_sources`),
    ).toHaveLength(0);
  });
  it("reports absent risks explicitly", async () => {
    await admin`delete from pgr_ges where pgr_id=${I.pgrA}`;
    const created = await registerMedicalRiskSourceAction(I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    expect(created.ok).toBe(true);
    const result = await getMedicalRiskInventoryAction(I.companyA);
    if (!result.ok) throw new Error("read failed");
    expect(result.data.rows[0].risks).toHaveLength(0);
    expect(
      result.data.rows[0].warnings.some((text) => text.includes("não comprova ausência")),
    ).toBe(true);
  });
  it("protects inventory APIs at the database boundary while preserving Medicine and shared GES", async () => {
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='pgr'`;
    for (const table of ["risks", "risk_assessments", "control_measures", "epi_risk"]) {
      expect(
        await withOrgTx(runtime, "org_a", (tx) => tx.unsafe(`select * from ${table}`)),
      ).toHaveLength(0);
    }
    await expect(
      withOrgTx(
        runtime,
        "org_a",
        (tx) =>
          tx`insert into risks (org_id,ges_id,agent_type,description) values ('org_a',${I.gesA},'physical','Not entitled')`,
      ),
    ).rejects.toThrow();
    expect(await withOrgTx(runtime, "org_a", (tx) => tx`select * from ges`)).toHaveLength(
      1,
    );
    expect((await registerMedicalRiskSourceAction(I.companyA, external)).ok).toBe(true);
  });
  it("applies the same restrictions over HTTP", async () => {
    const oldApp = process.env.APP_ENV,
      oldBypass = process.env.DEV_API_AUTH_BYPASS;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    const context = { params: Promise.resolve({ id: I.companyA }) };
    const req = (
      method: string,
      role: string,
      tenant = "org_a",
      body = JSON.stringify(external),
    ) =>
      new NextRequest(
        `http://localhost/api/v1/companies/${I.companyA}/medical-risk-sources`,
        {
          method,
          headers: {
            "x-dev-tenant": tenant,
            "x-dev-role": role,
            "content-type": "application/json",
          },
          ...(method === "POST" ? { body } : {}),
        },
      );
    try {
      expect((await POST(req("POST", "collaborator"), context)).status).toBe(201);
      expect((await GET(req("GET", "owner"), context)).status).toBe(200);
      expect((await GET(req("GET", "client"), context)).status).toBe(403);
      expect((await GET(req("GET", "owner", "org_b"), context)).status).toBe(404);
      expect((await POST(req("POST", "owner", "org_a", "{"), context)).status).toBe(422);
    } finally {
      if (oldApp === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = oldApp;
      if (oldBypass === undefined) delete process.env.DEV_API_AUTH_BYPASS;
      else process.env.DEV_API_AUTH_BYPASS = oldBypass;
    }
  });
});
