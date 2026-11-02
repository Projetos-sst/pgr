/**
 * Critérios de interpretação e condutas (NOB-153) contra Postgres efêmero, pelo fluxo real: plano
 * aprovado pela coordenadora vinculada → critérios versionados por ela → conferência e prévia do
 * PCMSO. Autoria só pelo vínculo (equipe, owner, vínculo revogado e designação encerrada recusam);
 * só inclusão; isolamento, módulo e perfil cliente. Dados fictícios.
 */
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
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import type { PcmsoContent } from "@/shared/domains/medicine/pcmso-composition";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import { link } from "@/shared/server/medicine/professional-links-core";
import {
  approve,
  createDraft,
  decideItem,
  getPlan,
} from "@/shared/server/medicine/exam-plan-core";
import {
  criteriaHistory,
  defineCriteria,
  listCriteria,
} from "@/shared/server/medicine/interpretation-criteria-core";
import { getPcmsoReadiness } from "@/shared/server/medicine/pcmso-readiness-core";
import {
  generateDocument,
  getDocument,
} from "@/shared/server/medicine/pcmso-document-core";
import { defineInterpretationCriteriaAction } from "@/shared/server/actions/medicine/interpretation-criteria";
import {
  GET as LIST,
  POST as DEFINE,
} from "@/app/api/v1/companies/[id]/interpretation-criteria/route";
import { GET as HISTORY } from "@/app/api/v1/companies/[id]/interpretation-criteria/[code]/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const owner: TenantContext = {
  tenantId: "org_a",
  userId: "owner",
  role: "owner",
  plan: "free",
};
const staff: TenantContext = { ...owner, userId: "staff", role: "collaborator" };
const doctor: TenantContext = { ...owner, userId: "doctor", role: "collaborator" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000051";
const CRITERIA = {
  code: "0281",
  criteria: "Critério fictício definido pela coordenadora.",
  conduct: "Conduta fictícia definida pela coordenadora.",
};

const req = (ctx: TenantContext, method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/v1/companies", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("interpretation criteria (NOB-153)", () => {
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
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','collaborator'),('org_a','doctor','collaborator'),('org_b','owner-b','owner')`;
    await admin`update companies set cnae='4120-4', main_activity='Construção de edifícios', risk_grade=3 where id=${I.companyA}`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status)
      values (${MEDICO}, 'org_a', 'Dra. Coordenadora Fictícia', '61001', 'physician', 'MA', '962', 'internal', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO}, '2026-01-01', 'owner')`;
    await admin`update risks set noxious_agent_code='02.01.001', possible_injuries='Perda auditiva induzida por ruído' where id=${I.riskA}`;
    const source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${source.id}`;
    await link(owner, MEDICO, { userId: "doctor", reason: "Coordenadora fictícia." });
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireOfficeStaff as jest.Mock).mockResolvedValue(staff);
  });

  async function approvedPlan() {
    const plan = await createDraft(staff, I.companyA);
    const [item] = (await getPlan(staff, plan.id)).items;
    await decideItem(doctor, plan.id, item.id, {
      decision: "kept",
      periodicity: "Admissional, anual e demissional",
    });
    return approve(doctor, plan.id, { note: "Aprovação fictícia." });
  }

  const readinessCodes = async () =>
    (await getPcmsoReadiness(staff, I.companyA)).items.map((i) => i.code);

  it("sem plano aprovado: nada a cobrir; o item não aparece na conferência", async () => {
    expect(await listCriteria(staff, I.companyA)).toEqual({
      approvedPlanVersion: null,
      rows: [],
      missing: [],
    });
    expect(await readinessCodes()).not.toContain("interpretation_criteria");
  });

  it("coordenadora vinculada define versões; conferência e prévia do PCMSO usam o vigente", async () => {
    await approvedPlan();
    const before = await listCriteria(staff, I.companyA);
    expect(before.approvedPlanVersion).toBe(1);
    expect(before.missing).toEqual([expect.objectContaining({ procedureCode: "0281" })]);
    const warning = (await getPcmsoReadiness(staff, I.companyA)).items.find(
      (i) => i.code === "interpretation_criteria",
    );
    expect(warning).toMatchObject({ severity: "warning", reference: "NR-7 7.5.4 c" });

    const v1 = await defineCriteria(doctor, I.companyA, CRITERIA);
    expect(v1).toMatchObject({
      version: 1,
      authoredByMedicoId: MEDICO,
      authoredByUser: "doctor",
      procedureCode: "0281",
    });
    const v2 = await defineCriteria(doctor, I.companyA, {
      ...CRITERIA,
      conduct: "Conduta fictícia revisada.",
    });
    expect(v2.version).toBe(2);
    expect(
      (await criteriaHistory(staff, I.companyA, "0281")).map((h) => h.version),
    ).toEqual([2, 1]);
    const after = await listCriteria(staff, I.companyA);
    expect(after.missing).toEqual([]);
    expect(after.rows[0].current).toMatchObject({
      version: 2,
      conduct: "Conduta fictícia revisada.",
      authorName: "Dra. Coordenadora Fictícia",
    });
    expect(await readinessCodes()).not.toContain("interpretation_criteria");

    const created = await generateDocument(staff, I.companyA, {
      cycleStart: "2026-11-01",
    });
    const content = (await getDocument(staff, created.id)).content as PcmsoContent;
    expect(content.interpretation.items).toEqual([
      expect.objectContaining({
        procedureCode: "0281",
        status: "defined",
        criteria: CRITERIA.criteria,
        conduct: "Conduta fictícia revisada.",
        author: "Dra. Coordenadora Fictícia",
        version: 2,
      }),
    ]);
    expect(content.pendingSections.map((s) => s.code)).not.toContain(
      "interpretation_criteria",
    );
  });

  it("autoria só pelo vínculo: equipe, owner, vínculo revogado e designação encerrada recusam; só inclusão", async () => {
    await approvedPlan();
    for (const ctx of [staff, owner])
      await expect(defineCriteria(ctx, I.companyA, CRITERIA)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    const invalid = await defineInterpretationCriteriaAction(I.companyA, {
      ...CRITERIA,
      conduct: "  ",
    });
    expect(!invalid.ok && invalid.error.code).toBe("VALIDATION");
    const v1 = await defineCriteria(doctor, I.companyA, CRITERIA);
    const asActor = (
      actor: string,
      fn: (tx: postgres.TransactionSql) => Promise<unknown>,
    ) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
        return fn(tx);
      });
    // Por SQL direto: equipe não insere; ninguém altera nem apaga versões.
    await expect(
      asActor(
        "staff",
        (tx) =>
          tx`insert into pcmso_interpretation_criteria (org_id, company_id, procedure_code, version, criteria, conduct, authored_by_medico_id, authored_by_user)
            values ('org_a', ${I.companyA}, '0281', 9, 'x', 'y', ${MEDICO}, 'staff')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor(
        "doctor",
        (tx) =>
          tx`update pcmso_interpretation_criteria set conduct='z' where id=${v1.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor(
        "doctor",
        (tx) => tx`delete from pcmso_interpretation_criteria where id=${v1.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    // Vínculo revogado.
    await admin`update medico_user_links set revoked_at=now(), revoked_by='owner', revoke_reason='Revogação fictícia.' where medico_id=${MEDICO}`;
    await expect(defineCriteria(doctor, I.companyA, CRITERIA)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await admin`update medico_user_links set revoked_at=null, revoked_by=null, revoke_reason=null where medico_id=${MEDICO}`;
    // Designação encerrada.
    await admin`update pcmso_coordinator_assignments set ends_on='2026-06-30', end_reason='Encerramento fictício.' where medico_id=${MEDICO}`;
    await expect(defineCriteria(doctor, I.companyA, CRITERIA)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // A versão já registrada continua no histórico.
    expect(await criteriaHistory(staff, I.companyA, "0281")).toHaveLength(1);
  });

  it("isolamento, módulo e perfil cliente; REST", async () => {
    await approvedPlan();
    const company = { params: Promise.resolve({ id: I.companyA }) };
    expect((await DEFINE(req(staff, "POST", CRITERIA), company)).status).toBe(403);
    const created = await DEFINE(req(doctor, "POST", CRITERIA), company);
    expect(created.status).toBe(201);
    expect((await LIST(req(staff), company)).status).toBe(200);
    expect(
      (
        await HISTORY(req(staff), {
          params: Promise.resolve({ id: I.companyA, code: "0281" }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await HISTORY(req(staff), {
          params: Promise.resolve({ id: I.companyA, code: "12" }),
        })
      ).status,
    ).toBe(422);
    expect((await LIST(req({ ...owner, role: "client" }), company)).status).toBe(403);
    expect((await LIST(req(ownerB), company)).status).toBe(404);
    await expect(listCriteria(ownerB, I.companyA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    await expect(listCriteria(staff, I.companyA)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
