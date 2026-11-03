/**
 * Relatório analítico anual (NOB-154) contra Postgres efêmero. Contagens reais sem duplicidade e
 * só da empresa de origem; CAT só registradas; informação insuficiente ≠ zero; período anual a
 * partir do último relatório; simplificação do 7.6.6; autoria pelo vínculo do coordenador (equipe,
 * owner, cliente e vínculo revogado recusam); imutabilidade; integração com o PCMSO. Fictício.
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
jest.mock("@/shared/dates", () => ({
  ...jest.requireActual("@/shared/dates"),
  todayInSaoPaulo: () => "2026-11-02",
}));
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import {
  analyticalReportHash,
  type AnalyticalReportContent,
} from "@/shared/domains/medicine/analytical-report";
import { linkByInvitation as link } from "../_helpers/professional-link";
import {
  generateReport,
  getReport,
  getReportContext,
  listReports,
} from "@/shared/server/medicine/analytical-report-core";
import { getPcmsoReadiness } from "@/shared/server/medicine/pcmso-readiness-core";
import { generateAnalyticalReportAction } from "@/shared/server/actions/medicine/analytical-reports";
import {
  GET as LIST,
  POST as GENERATE,
} from "@/app/api/v1/companies/[id]/analytical-reports/route";
import { GET as CONTEXT } from "@/app/api/v1/companies/[id]/analytical-reports/context/route";
import { GET as SHOW } from "@/app/api/v1/analytical-reports/[id]/route";
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
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000061";
const COMPANY_C = "cccccccc-0000-4000-8000-000000000062";
const EMPLOYEE_2 = "cccccccc-0000-4000-8000-000000000063";
const FIRST = { periodStart: "2025-11-01", periodEnd: "2026-10-31" };

const req = (
  ctx: TenantContext,
  method = "GET",
  body?: unknown,
  url = "http://localhost/api",
) =>
  new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("analytical reports (NOB-154)", () => {
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
    await admin`update companies set risk_grade=3 where id=${I.companyA}`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status)
      values (${MEDICO}, 'org_a', 'Dra. Coordenadora Fictícia', '62001', 'physician', 'MA', '963', 'internal', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO}, '2025-01-01', 'owner')`;
    await admin`insert into companies (id, org_id, cnpj, razao_social) values (${COMPANY_C}, 'org_a', '33444555000166', 'C Fictícia Ltda')`;
    await admin`insert into company_modules (org_id, company_id, module, enabled) values ('org_a', ${COMPANY_C}, 'medicine', true)`;
    await admin`insert into employees (id, org_id, company_id, full_name, cpf) values (${EMPLOYEE_2}, 'org_a', ${I.companyA}, 'Func Dois', '11122233344')`;
    await link(owner, MEDICO, { userId: "doctor", reason: "Coordenadora fictícia." });
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireOfficeStaff as jest.Mock).mockResolvedValue(staff);
  });

  /** Exames e CAT fictícios do período 2025-11-01 a 2026-10-31 (e fora dele). */
  async function seedFacts() {
    const exam = (
      employee: string,
      type: string,
      date: string,
      company: string | null = null,
    ) =>
      company
        ? admin`insert into health_exams (org_id, employee_id, company_id, company_origin, exam_type, performed_at, aptitude)
            values ('org_a', ${employee}, ${company}, 'registered', ${type}, ${date}, 'fit') returning id`
        : admin`insert into health_exams (org_id, employee_id, exam_type, performed_at, aptitude)
            values ('org_a', ${employee}, ${type}, ${date}, 'fit') returning id`;
    const [e1] = await exam(I.employeeA, "periodic", "2026-03-10");
    await exam(I.employeeA, "periodic", "2026-03-10"); // repetido: conta uma vez
    await exam(EMPLOYEE_2, "admissional", "2026-01-15");
    await exam(I.employeeA, "periodic", "2025-06-01"); // fora do período
    await exam(I.employeeA, "periodic", "2026-02-01", COMPANY_C); // outra empresa
    // Exame anterior ao controle de origem: fica fora e é informado.
    await admin`alter table health_exams disable trigger health_exams_set_company`;
    await admin`insert into health_exams (org_id, employee_id, exam_type, performed_at, aptitude) values ('org_a', ${EMPLOYEE_2}, 'periodic', '2026-05-05', 'fit')`;
    await admin`alter table health_exams enable trigger health_exams_set_company`;
    await admin`insert into health_exam_procedures (org_id, company_id, health_exam_id, procedure_code, performed_at, created_by) values
      ('org_a', ${I.companyA}, ${e1.id}, '0281', '2026-03-08', 'staff'),
      ('org_a', ${I.companyA}, ${e1.id}, '0693', '2026-03-08', 'staff')`;
    const acc = (
      n: number,
      type: string,
      cat: string | null,
      issued: string | null,
      status = "registered",
      occurred = "2026-04-01",
    ) =>
      admin`insert into accidents (org_id, number, company_id, occurred_at, type, category, severity, status, cat_number, cat_issued_at)
        values ('org_a', ${n}, ${I.companyA}, ${occurred}, ${type}, 'with_leave', 'minor', ${status}, ${cat}, ${issued})`;
    await acc(1, "typical", "CAT-FICT-1", "2026-04-02");
    await acc(2, "occupational_disease", "CAT-FICT-2", "2026-06-10");
    await acc(3, "typical", "CAT-FICT-3", "2026-06-11", "cancelled");
    await acc(4, "commute", null, null);
    await acc(5, "commute", "CAT-FICT-5", null);
    await acc(6, "typical", "CAT-FICT-6", "2025-05-01", "registered", "2025-04-30");
  }

  it("contagens reais sem duplicidade; c e d insuficientes; CAT só registradas; sem dado individual", async () => {
    await seedFacts();
    const context = await getReportContext(staff, I.companyA, FIRST);
    expect(context).toMatchObject({
      previous: null,
      issues: [],
      totals: { clinicalExams: 2, unverifiedOrigin: 1, complementaryExams: 2, cats: 2 },
    });
    const created = await generateReport(doctor, I.companyA, FIRST);
    expect(created).toMatchObject({
      version: 1,
      status: "preview",
      periodStart: "2025-11-01",
      periodEnd: "2026-10-31",
      authoredByMedicoId: MEDICO,
      generatedBy: "doctor",
      previousReportId: null,
    });
    const doc = await getReport(staff, created.id);
    const content = doc.content as AnalyticalReportContent;
    expect(content.items.a).toMatchObject({
      status: "available",
      total: 2,
      duplicatesIgnored: 1,
      unverifiedOrigin: 1,
    });
    expect(content.items.a.byType.map((t) => [t.examType, t.count])).toEqual([
      ["admissional", 1],
      ["periodic", 1],
    ]);
    expect(content.items.b.byProcedure.map((p) => [p.procedureCode, p.count])).toEqual([
      ["0281", 1],
      ["0693", 1],
    ]);
    expect(content.items.c.status).toBe("insufficient");
    expect(content.items.d.status).toBe("insufficient");
    expect(content.items.e).toMatchObject({
      status: "registered_only",
      total: 2,
      withoutIssueDate: 1,
    });
    if (content.items.e.status !== "registered_only") throw new Error();
    expect(content.items.e.byType.map((t) => [t.type, t.count])).toEqual([
      ["typical", 1],
      ["occupational_disease", 1],
    ]);
    expect(content.items.f.status).toBe("no_previous");
    expect(content.author).toMatchObject({
      name: "Dra. Coordenadora Fictícia",
      registration: "CRM 62001/MA",
    });
    expect(content.simplification).toMatchObject({ eligible: true, applied: false });
    const text = JSON.stringify(content);
    for (const secret of [
      "Func A",
      "Func Dois",
      "12345678901",
      "11122233344",
      "CAT-FICT",
    ])
      expect(text).not.toContain(secret);
    expect(doc.contentSha256).toBe(analyticalReportHash(content));
  });

  it("período anual a partir do último relatório e discussão obrigatória do coordenador", async () => {
    await seedFacts();
    await generateReport(doctor, I.companyA, FIRST);
    const context = await getReportContext(staff, I.companyA);
    expect(context.suggestedPeriod).toEqual({
      periodStart: "2026-11-01",
      periodEnd: "2026-11-02",
    });
    // Equipe não elabora (a autorização vem antes da validação do período).
    const asStaff = await generateAnalyticalReportAction(I.companyA, FIRST);
    expect(!asStaff.ok && asStaff.error.code).toBe("FORBIDDEN");
    (requireOfficeStaff as jest.Mock).mockResolvedValue(doctor);
    // Já existe relatório até 2026-10-31: novo período precisa começar em 2026-11-01.
    const wrongStart = await generateAnalyticalReportAction(I.companyA, FIRST);
    expect(!wrongStart.ok && wrongStart.error.message).toMatch(/começa em 2026-11-01/);
    const future = await generateAnalyticalReportAction(I.companyA, {
      periodStart: "2026-11-01",
      periodEnd: "2026-12-31",
    });
    expect(!future.ok && future.error.message).toMatch(/futuro/);
    const noDiscussion = await generateAnalyticalReportAction(I.companyA, {
      periodStart: "2026-11-01",
      periodEnd: "2026-11-02",
    });
    expect(!noDiscussion.ok && noDiscussion.error.message).toMatch(/discussão/);
    const second = await generateReport(doctor, I.companyA, {
      periodStart: "2026-11-01",
      periodEnd: "2026-11-02",
      variationDiscussion: "Discussão fictícia da coordenadora sobre as variações.",
    });
    expect(second.version).toBe(2);
    const content = (await getReport(staff, second.id))
      .content as AnalyticalReportContent;
    expect(content.items.f.status).toBe("compared");
    if (content.items.f.status !== "compared") throw new Error();
    expect(content.items.f.comparisons).toEqual(
      expect.arrayContaining([
        {
          indicator: "Exames clínicos realizados",
          previous: 2,
          current: 0,
          difference: -2,
        },
      ]),
    );
    expect(content.items.f.discussion).toMatch(/Discussão fictícia/);
    expect((await listReports(staff, I.companyA)).map((r) => r.version)).toEqual([2, 1]);
  });

  it("simplificação do 7.6.6 só para quem se enquadra", async () => {
    await admin`update companies set risk_grade=3 where id=${I.companyA}`;
    for (let i = 0; i < 10; i += 1)
      await admin`insert into employees (org_id, company_id, full_name, cpf) values ('org_a', ${I.companyA}, ${`Func extra ${i}`}, ${`900000000${String(i).padStart(2, "0")}`})`;
    await expect(
      generateReport(doctor, I.companyA, { ...FIRST, simplified: true }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await admin`update companies set risk_grade=2 where id=${I.companyA}`;
    const created = await generateReport(doctor, I.companyA, {
      ...FIRST,
      simplified: true,
    });
    const content = (await getReport(staff, created.id))
      .content as AnalyticalReportContent;
    expect(content.simplification).toMatchObject({ eligible: true, applied: true });
    for (const key of ["c", "d", "e", "f"] as const)
      expect(content.items[key].status).toBe("not_required");
  });

  it("autoria só pelo vínculo do coordenador; imutável; isolamento, módulo e perfis", async () => {
    for (const ctx of [staff, owner])
      await expect(generateReport(ctx, I.companyA, FIRST)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    const created = await generateReport(doctor, I.companyA, FIRST);
    const asActor = (
      actor: string,
      fn: (tx: postgres.TransactionSql) => Promise<unknown>,
    ) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
        return fn(tx);
      });
    await expect(
      asActor(
        "staff",
        (tx) =>
          tx`insert into pcmso_analytical_reports (org_id, company_id, version, period_start, period_end, content, content_sha256, authored_by_medico_id, generated_by)
            values ('org_a', ${I.companyA}, 9, '2024-01-01', '2024-12-31', '{}', ${"a".repeat(64)}, ${MEDICO}, 'staff')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor(
        "doctor",
        (tx) =>
          tx`update pcmso_analytical_reports set content='{}' where id=${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor(
        "doctor",
        (tx) => tx`delete from pcmso_analytical_reports where id=${created.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor(
        "doctor",
        (tx) =>
          tx`insert into pcmso_analytical_reports (org_id, company_id, version, status, period_start, period_end, content, content_sha256, authored_by_medico_id, generated_by)
            values ('org_a', ${I.companyA}, 8, 'issued', '2024-01-01', '2024-12-31', '{}', ${"a".repeat(64)}, ${MEDICO}, 'doctor')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
    // Vínculo revogado.
    await admin`update medico_user_links set revoked_at=now(), revoked_by='owner', revoke_reason='Revogação fictícia.' where medico_id=${MEDICO}`;
    await expect(
      generateReport(doctor, I.companyA, {
        periodStart: "2026-11-01",
        periodEnd: "2026-11-02",
        variationDiscussion: "Texto fictício.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const company = { params: Promise.resolve({ id: I.companyA }) };
    expect((await LIST(req(staff), company)).status).toBe(200);
    expect((await LIST(req({ ...owner, role: "client" }), company)).status).toBe(403);
    expect((await LIST(req(ownerB), company)).status).toBe(404);
    expect((await GENERATE(req(staff, "POST", FIRST), company)).status).toBe(403);
    expect(
      (
        await CONTEXT(
          req(
            staff,
            "GET",
            undefined,
            "http://localhost/api?periodStart=2025-11-01&periodEnd=2026-10-31",
          ),
          company,
        )
      ).status,
    ).toBe(200);
    expect(
      (await SHOW(req(staff), { params: Promise.resolve({ id: created.id }) })).status,
    ).toBe(200);
    expect(
      (await SHOW(req(ownerB), { params: Promise.resolve({ id: created.id }) })).status,
    ).toBe(404);
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    await expect(listReports(staff, I.companyA)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("REST: coordenador vinculado gera (201); conferência do PCMSO reconhece o relatório", async () => {
    const codes = async () =>
      (await getPcmsoReadiness(staff, I.companyA)).items.map((i) => i.code);
    expect(await codes()).toContain("analytical_report");
    const created = await GENERATE(req(doctor, "POST", FIRST), {
      params: Promise.resolve({ id: I.companyA }),
    });
    expect(created.status).toBe(201);
    expect(await codes()).not.toContain("analytical_report");
  });
});
