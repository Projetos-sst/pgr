/**
 * PCMSO composto (NOB-151) contra Postgres efêmero, pelo fluxo real: fonte validada →
 * rascunho do plano (equipe) → decisão e aprovação pela coordenadora vinculada → prévia
 * arquivada com hash. Bloqueia sem plano aprovado; versões imutáveis (sem UPDATE/DELETE);
 * RLS exige plano aprovado; isolamento, módulo e perfil cliente. Dados fictícios.
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
import {
  pcmsoContentHash,
  type PcmsoContent,
} from "@/shared/domains/medicine/pcmso-composition";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import { link } from "@/shared/server/medicine/professional-links-core";
import {
  approve,
  createDraft,
  decideItem,
  getPlan,
} from "@/shared/server/medicine/exam-plan-core";
import {
  generateDocument,
  getDocument,
  listDocuments,
} from "@/shared/server/medicine/pcmso-document-core";
import { generatePcmsoDocumentAction } from "@/shared/server/actions/medicine/pcmso-documents";
import {
  GET as LIST,
  POST as GENERATE,
} from "@/app/api/v1/companies/[id]/pcmso-documents/route";
import { GET as SHOW } from "@/app/api/v1/pcmso-documents/[id]/route";
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
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000031";

const req = (ctx: TenantContext, method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/v1/pcmso-documents", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("pcmso documents (NOB-151)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
    await applyMigrations(admin);
    runtime = (await import("postgres")).default(
      process.env.INTEGRATION_APP_RUNTIME_URL!,
      {
        max: 1,
        prepare: false,
      },
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
      values (${MEDICO}, 'org_a', 'Dra. Coordenadora Fictícia', '60001', 'physician', 'MA', '961', 'internal', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO}, '2026-01-01', 'owner')`;
    await admin`update risks set noxious_agent_code='02.01.001', possible_injuries='Perda auditiva induzida por ruído' where id=${I.riskA}`;
    const source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${source.id}`;
    await link(owner, MEDICO, {
      userId: "doctor",
      reason: "Coordenadora com acesso próprio.",
    });
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

  it("sem plano aprovado, a prévia é recusada com as pendências", async () => {
    const denied = await generatePcmsoDocumentAction(I.companyA, {
      validityStart: "2026-11-01",
    });
    expect(!denied.ok && denied.error.code).toBe("VALIDATION");
    expect(!denied.ok && denied.error.message).toMatch(/plano de exames/i);
    expect(await admin`select * from pcmso_documents`).toHaveLength(0);
  });

  it("compõe a prévia com riscos, agravos, exames e periodicidade aprovados, vigência e hash", async () => {
    const plan = await approvedPlan();
    const created = await generateDocument(staff, I.companyA, {
      validityStart: "2026-11-01",
    });
    expect(created).toMatchObject({
      version: 1,
      status: "preview",
      validityStart: "2026-11-01",
      validityEnd: "2027-10-31",
      examPlanId: plan.id,
      generatedBy: "staff",
    });
    const doc = await getDocument(staff, created.id);
    const content = doc.content as PcmsoContent;
    expect(content.notice).toMatch(/PRÉVIA/);
    expect(content.coordinator).toMatchObject({
      name: "Dra. Coordenadora Fictícia",
      rqe: "961",
    });
    expect(content.examPlan).toMatchObject({
      version: 1,
      approvedBy: "Dra. Coordenadora Fictícia",
    });
    expect(content.groups).toEqual([
      expect.objectContaining({
        risks: [
          expect.objectContaining({
            possibleInjuries: "Perda auditiva induzida por ruído",
          }),
        ],
        exams: [
          expect.objectContaining({
            procedureCode: "0281",
            periodicity: "Admissional, anual e demissional",
          }),
        ],
      }),
    ]);
    expect(content.pendingSections.map((s) => s.code)).toEqual([
      "interpretation_criteria",
      "clinics",
      "health_campaigns",
      "analytical_report",
    ]);
    expect(doc.contentSha256).toBe(pcmsoContentHash(content));
  });

  it("versões arquivadas são imutáveis e numeradas; RLS exige plano aprovado", async () => {
    const plan = await approvedPlan();
    const v1 = await generateDocument(staff, I.companyA, { validityStart: "2026-11-01" });
    const v2 = await generateDocument(staff, I.companyA, { validityStart: "2026-12-01" });
    expect(v2.version).toBe(2);
    expect((await listDocuments(staff, I.companyA)).map((d) => d.version)).toEqual([
      2, 1,
    ]);
    const asStaff = (fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'staff', true)`;
        return fn(tx);
      });
    await expect(
      asStaff(
        (tx) =>
          tx`update pcmso_documents set validity_end='2030-01-01' where id=${v1.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asStaff((tx) => tx`delete from pcmso_documents where id=${v1.id}`),
    ).rejects.toMatchObject({ code: "42501" });
    // Plano não aprovado não origina versão, nem por SQL direto.
    await admin`insert into medical_exam_plans (org_id, company_id, version, status, based_on, rules_version, catalog_version, prepared_by) values ('org_a', ${I.companyA}, 9, 'draft', '{}', 'r', 'c', 'staff')`;
    const [draft] = await admin`select id from medical_exam_plans where version=9`;
    await expect(
      asStaff(
        (tx) =>
          tx`insert into pcmso_documents (org_id, company_id, version, validity_start, validity_end, exam_plan_id, content, content_sha256, generated_by)
            values ('org_a', ${I.companyA}, 99, '2026-01-01', '2026-12-31', ${draft.id}, '{}', ${"a".repeat(64)}, 'staff')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    // Status diferente de prévia é barrado pelo CHECK (não há emissão oficial sem assinatura).
    await expect(
      asStaff(
        (tx) =>
          tx`insert into pcmso_documents (org_id, company_id, version, status, validity_start, validity_end, exam_plan_id, content, content_sha256, generated_by)
            values ('org_a', ${I.companyA}, 98, 'issued', '2026-01-01', '2026-12-31', ${plan.id}, '{}', ${"a".repeat(64)}, 'staff')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("data-base inválida, isolamento e módulo", async () => {
    await approvedPlan();
    const invalid = await generatePcmsoDocumentAction(I.companyA, {
      validityStart: "01/11/2026",
    });
    expect(!invalid.ok && invalid.error.code).toBe("VALIDATION");
    const created = await generateDocument(staff, I.companyA, {
      validityStart: "2026-11-01",
    });
    await expect(getDocument(ownerB, created.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    await expect(listDocuments(staff, I.companyA)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("REST: gerar (201), listar, detalhar e papéis", async () => {
    await approvedPlan();
    const company = { params: Promise.resolve({ id: I.companyA }) };
    const created = await GENERATE(
      req(staff, "POST", { validityStart: "2026-11-01" }),
      company,
    );
    expect(created.status).toBe(201);
    const { id } = await created.json();
    expect((await LIST(req(staff), company)).status).toBe(200);
    expect((await LIST(req({ ...owner, role: "client" }), company)).status).toBe(403);
    expect((await SHOW(req(staff), { params: Promise.resolve({ id }) })).status).toBe(
      200,
    );
    expect((await SHOW(req(ownerB), { params: Promise.resolve({ id }) })).status).toBe(
      404,
    );
  });
});
