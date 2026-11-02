/**
 * Conferência do PCMSO (NOB-148) contra Postgres efêmero: dados reais de empresa, coordenador,
 * inventário validado e médicos; isolamento por tenant, módulo Medicina e perfil cliente.
 * A validação técnica do risco e a designação do coordenador entram por fixture (admin): os
 * fluxos de origem já são cobertos em `risk-authorizations` e `pcmso-coordinators`. Dados fictícios.
 */
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
import { registerMedicalRiskSourceAction } from "@/shared/server/actions/medicine/risk-sources";
import { getPcmsoReadinessAction } from "@/shared/server/actions/medicine/pcmso-readiness";
import { GET } from "@/app/api/v1/companies/[id]/pcmso-readiness/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const MEDICO = "b1111111-1111-4111-8111-111111111111";

const gate = (tenantId = "org_a") =>
  (requireOfficeStaff as jest.Mock).mockResolvedValue({
    userId: "registrador",
    tenantId,
    role: "owner",
    plan: "free",
  });

(enabled ? describe : describe.skip)("pcmso readiness (NOB-148)", () => {
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
    gate();
  });

  async function completeData() {
    await admin`update companies set cnae='4120-4', main_activity='Construção de edifícios', risk_grade=3 where id=${I.companyA}`;
    await admin`update risks set noxious_agent_code='02.01.001', possible_injuries='Perda auditiva' where id=${I.riskA}`;
    await admin`insert into medicos (id, org_id, name, crm, registration_uf, rqe, profession, affiliation, status)
      values (${MEDICO}, 'org_a', 'Dra. Fictícia', '12345', 'SP', '6789', 'physician', 'internal', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO}, '2026-01-01', 'registrador')`;
    const created = await registerMedicalRiskSourceAction(I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    if (!created.ok) throw new Error(`fixture: ${created.error.code}`);
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof-ficticio', reviewed_at=now() where source_id=${created.data.id}`;
  }

  const codes = (items: { code: string; severity: string }[], severity: string) =>
    items.filter((i) => i.severity === severity).map((i) => i.code);

  it("com os dados completos, sobram só as etapas inexistentes e o PCMSO não fica pronto", async () => {
    await completeData();
    const result = await getPcmsoReadinessAction(I.companyA);
    if (!result.ok) throw new Error(result.error.code);
    expect(codes(result.data.items, "blocking")).toEqual([]);
    expect(codes(result.data.items, "warning")).toEqual([]);
    expect(codes(result.data.items, "not_available")).toEqual([
      "exam_plan",
      "interpretation_criteria",
      "clinics",
      "health_campaigns",
      "analytical_report",
    ]);
    expect(result.data.ready).toBe(false);
  });

  it("sem dados da empresa, coordenador, fonte e médico, bloqueia cada um", async () => {
    const result = await getPcmsoReadinessAction(I.companyA);
    if (!result.ok) throw new Error(result.error.code);
    expect(codes(result.data.items, "blocking")).toEqual([
      "company_cnae",
      "company_activity",
      "company_risk_grade",
      "coordinator",
      "risk_source",
      "examiners",
    ]);
  });

  it("coordenador encerrado não conta; risco pendente avisa e não conta como validado", async () => {
    await completeData();
    await admin`update pcmso_coordinator_assignments set ends_on='2026-06-30', end_reason='Encerramento fictício', ended_by='registrador'`;
    await admin`update medical_risk_entries set status='pending', reviewed_by=null, reviewed_at=null`;
    const result = await getPcmsoReadinessAction(I.companyA);
    if (!result.ok) throw new Error(result.error.code);
    expect(codes(result.data.items, "blocking")).toEqual([
      "coordinator",
      "validated_risks",
    ]);
    expect(codes(result.data.items, "warning")).toEqual(["pending_risks"]);
  });

  it("isolamento, módulo e entrada inválida", async () => {
    await completeData();
    gate("org_b");
    const other = await getPcmsoReadinessAction(I.companyA);
    expect(!other.ok && other.error.code).toBe("NOT_FOUND");
    gate();
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    const denied = await getPcmsoReadinessAction(I.companyA);
    expect(!denied.ok && denied.error.code).toBe("FORBIDDEN");
    const invalid = await getPcmsoReadinessAction("nao-e-uuid");
    expect(!invalid.ok && invalid.error.code).toBe("VALIDATION");
  });

  it("REST respeita papel e tenant", async () => {
    await completeData();
    const oldApp = process.env.APP_ENV,
      oldBypass = process.env.DEV_API_AUTH_BYPASS;
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    const req = (role: string, tenant = "org_a") =>
      new NextRequest(`http://localhost/api/v1/companies/${I.companyA}/pcmso-readiness`, {
        headers: {
          "x-dev-tenant": tenant,
          "x-dev-role": role,
          "x-dev-user": "registrador",
        },
      });
    const context = { params: Promise.resolve({ id: I.companyA }) };
    try {
      const ok = await GET(req("owner"), context);
      expect(ok.status).toBe(200);
      expect((await ok.json()).ready).toBe(false);
      expect((await GET(req("collaborator"), context)).status).toBe(200);
      expect((await GET(req("client"), context)).status).toBe(403);
      expect((await GET(req("owner", "org_b"), context)).status).toBe(404);
    } finally {
      if (oldApp === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = oldApp;
      if (oldBypass === undefined) delete process.env.DEV_API_AUTH_BYPASS;
      else process.env.DEV_API_AUTH_BYPASS = oldBypass;
    }
  });
});
