import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn().mockResolvedValue({
    tenantId: "org_a",
    userId: "staff",
    role: "owner",
    plan: "free",
  }),
}));
jest.mock("@/shared/integrations/storage/company-logo-storage", () => ({
  downloadCompanyLogo: jest.fn().mockResolvedValue(null),
}));
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";
import { getPgrReadiness } from "@/shared/server/pgr/pgr-readiness-core";
import { getPgrReadinessAction } from "@/shared/server/actions/pgr/pgr-readiness";
import { generatePgrDocx } from "@/shared/server/platform/pgr-docx-core";
import { extractDocxText } from "@/shared/integrations/docx/template-engine";
import { GET } from "@/app/api/v1/pgr/[id]/readiness/route";
const enabled = !!process.env.INTEGRATION_APP_RUNTIME_URL;
(enabled ? describe : describe.skip)("PGR readiness and consistent exports", () => {
  let admin: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages=warning`;
    await applyMigrations(admin);
  });
  afterAll(async () => {
    process.env = originalEnv;
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });
  it("returns explicit missing fields while preserving preview generation", async () => {
    const readiness = await getPgrReadiness("org_a", I.pgrA);
    expect(readiness.ready).toBe(false);
    expect(readiness.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    const preview = await generatePgrDocx("org_a", I.pgrA);
    expect(extractDocxText(preview.file)).toContain("PRÉVIA PARA CONFERÊNCIA");
    await expect(
      generatePgrDocx("org_a", I.pgrA, {
        purpose: "issue",
        expectedSourceSha256: readiness.sourceSha256,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("generates after a current passing report and preserves generation provenance", async () => {
    await admin`update pgr set responsible='Profissional fictício',issued_at='2026-01-01',valid_until='2027-01-01' where id=${I.pgrA}`;
    await admin`update ges set process_description='Processo fictício observado' where id=${I.gesA}`;
    await admin`update risks set hazard='Perigo observado',sources='Fonte observada',possible_injuries='Informação declarada' where id=${I.riskA}`;
    await admin`update risk_assessments set result='moderate' where id=${I.riskAssessmentA}`;
    const report = await getPgrReadiness("org_a", I.pgrA);
    expect(report.issues).toEqual([]);
    const result = await generatePgrDocx("org_a", I.pgrA, {
      purpose: "issue",
      expectedSourceSha256: report.sourceSha256,
    });
    expect(extractDocxText(result.file)).toContain("Documento gerado após conferência");
    expect(result.provenance.fileSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("detects changes after the report and isolates tenant/module access", async () => {
    const first = await getPgrReadiness("org_a", I.pgrA);
    await admin`update risks set description='Alteração posterior' where id=${I.riskA}`;
    expect((await getPgrReadiness("org_a", I.pgrA)).sourceSha256).not.toBe(
      first.sourceSha256,
    );
    await expect(
      generatePgrDocx("org_a", I.pgrA, {
        purpose: "issue",
        expectedSourceSha256: first.sourceSha256,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(getPgrReadiness("org_b", I.pgrA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='pgr'`;
    await expect(getPgrReadiness("org_a", I.pgrA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("exposes the same report through staff-protected Actions and HTTP", async () => {
    const action = await getPgrReadinessAction(I.pgrA);
    expect(action.ok).toBe(true);
    const req = (role: string) =>
      new NextRequest(`http://localhost/api/v1/pgr/${I.pgrA}/readiness`, {
        headers: { "x-dev-tenant": "org_a", "x-dev-user": "staff", "x-dev-role": role },
      });
    const params = { params: Promise.resolve({ id: I.pgrA }) };
    expect((await GET(req("owner"), params)).status).toBe(200);
    expect((await GET(req("client"), params)).status).toBe(403);
  });
});
