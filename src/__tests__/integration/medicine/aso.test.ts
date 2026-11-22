/**
 * ASO (NOB-152) contra Postgres efêmero, pelo fluxo real: exame com empresa gravada pelo servidor
 * (MED-07) → exames complementares com data → conferência da NR-7 7.5.19.1 → prévia arquivada.
 * Bloqueios por dado incompleto, riscos pendentes e exame de outra empresa; prévias imutáveis;
 * observações clínicas fora do conteúdo; isolamento, módulo e perfil cliente. Dados fictícios.
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
import { asoContentHash, type AsoContent } from "@/shared/domains/medicine/aso";
import {
  createHealthExam,
  deleteHealthExam,
} from "@/shared/db/repositories/health-exams";
import { deleteEmployee } from "@/shared/db/repositories/employees";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import { linkByInvitation as link } from "../_helpers/professional-link";
import {
  approve,
  createDraft,
  decideItem,
  getPlan,
} from "@/shared/server/medicine/exam-plan-core";
import {
  addProcedure,
  confirmCompanyOrigin,
  confirmExaminerConclusion,
  generateDocument,
  getAsoReadiness,
  getDocument,
  listDocuments,
  listProcedures,
  removeProcedure,
} from "@/shared/server/medicine/aso-core";
import {
  addExamProcedureAction,
  generateAsoDocumentAction,
} from "@/shared/server/actions/medicine/aso";
import {
  GET as LIST_PROCEDURES,
  POST as ADD_PROCEDURE,
} from "@/app/api/v1/health-exams/[id]/procedures/route";
import { DELETE as REMOVE_PROCEDURE } from "@/app/api/v1/health-exams/[id]/procedures/[procedureId]/route";
import { GET as READINESS } from "@/app/api/v1/health-exams/[id]/aso-readiness/route";
import {
  GET as LIST_DOCS,
  POST as GENERATE,
} from "@/app/api/v1/health-exams/[id]/aso-documents/route";
import { GET as SHOW_DOC } from "@/app/api/v1/aso-documents/[id]/route";
import { POST as CONFIRM_ORIGIN } from "@/app/api/v1/health-exams/[id]/company-origin/route";
import {
  GET as LIST_CONCLUSIONS,
  POST as CONFIRM_CONCLUSION,
} from "@/app/api/v1/health-exams/[id]/examiner-conclusions/route";
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
const examiner: TenantContext = { ...owner, userId: "examiner", role: "collaborator" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const COORDINATOR = "aaaaaaaa-0000-4000-8000-000000000041";
const EXAMINER = "aaaaaaaa-0000-4000-8000-000000000042";
const PSYCHOLOGIST = "aaaaaaaa-0000-4000-8000-000000000043";
const COORDINATOR_2 = "aaaaaaaa-0000-4000-8000-000000000044";
const COMPANY_C = "cccccccc-0000-4000-8000-000000000044";
const GES_WITHOUT_RISKS = "cccccccc-0000-4000-8000-000000000045";
const SECRET_NOTE = "Observação clínica sigilosa fictícia";

const req = (ctx: TenantContext, method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/v1/health-exams", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("ASO (NOB-152)", () => {
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

  let sourceId: string;
  beforeEach(async () => {
    jest.clearAllMocks();
    await seedPgrBase(admin);
    await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('examiner','e@example.test'),('owner-b','ob@example.test')`;
    await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','collaborator'),('org_a','doctor','collaborator'),('org_a','examiner','collaborator'),('org_b','owner-b','owner')`;
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status) values
      (${COORDINATOR}, 'org_a', 'Dra. Coordenadora Fictícia', '60001', 'physician', 'MA', '961', 'internal', 'active'),
      (${EXAMINER}, 'org_a', 'Dr. Examinador Fictício', '60002', 'physician', 'MA', null, 'external', 'active'),
      (${PSYCHOLOGIST}, 'org_a', 'Psicóloga Fictícia', '60003', 'psychologist', 'MA', null, 'external', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${COORDINATOR}, '2026-01-01', 'owner')`;
    await admin`insert into companies (id, org_id, cnpj, razao_social) values (${COMPANY_C}, 'org_a', '33444555000166', 'C Fictícia Ltda')`;
    await admin`insert into company_modules (org_id, company_id, module, enabled) values ('org_a', ${COMPANY_C}, 'medicine', true)`;
    await admin`update risks set noxious_agent_code='02.01.001' where id=${I.riskA}`;
    const source = await registerMedicalRiskSource(owner, I.companyA, {
      kind: "internal",
      pgrId: I.pgrA,
    });
    sourceId = source.id;
    await link(owner, COORDINATOR, {
      userId: "doctor",
      reason: "Coordenadora fictícia.",
    });
    await link(owner, EXAMINER, {
      userId: "examiner",
      reason: "Examinador fictício com acesso próprio.",
    });
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireOfficeStaff as jest.Mock).mockResolvedValue(staff);
  });

  const validateRisks = () =>
    admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${sourceId}`;

  async function approvedPlan() {
    const plan = await createDraft(staff, I.companyA);
    const [item] = (await getPlan(staff, plan.id)).items;
    await decideItem(doctor, plan.id, item.id, {
      decision: "kept",
      periodicity: "Admissional, anual e demissional",
    });
    return approve(doctor, plan.id, { note: "Aprovação fictícia." });
  }

  // NOB-155: a observação clínica de controle fica no prontuário segregado e não pode vazar no ASO.
  const newExam = async (
    overrides: Record<string, unknown> = {},
    { clinicalNote = true } = {},
  ) => {
    const exam = await createHealthExam("org_a", {
      employeeId: I.employeeA,
      doctorId: EXAMINER,
      examType: "periodic",
      performedAt: "2026-10-20",
      aptitude: "fit_with_restrictions",
      ...overrides,
    } as Parameters<typeof createHealthExam>[1]);
    if (clinicalNote)
      await admin`insert into health_exam_clinical_notes (org_id, health_exam_id, origin, content)
        values ('org_a', ${exam.id}, 'legacy_exam_notes', ${SECRET_NOTE})`;
    return exam;
  };

  /** Exame anterior à 0064: sem empresa de origem (o trigger só existe a partir dela). */
  async function legacyExam(aptitude = "fit") {
    await admin`alter table health_exams disable trigger health_exams_set_company`;
    try {
      const [row] =
        await admin`insert into health_exams (org_id, employee_id, doctor_id, exam_type, performed_at, aptitude)
        values ('org_a', ${I.employeeA}, ${EXAMINER}, 'periodic', '2026-03-10', ${aptitude}) returning id, company_id, company_origin`;
      return row as {
        id: string;
        company_id: string | null;
        company_origin: string | null;
      };
    } finally {
      await admin`alter table health_exams enable trigger health_exams_set_company`;
    }
  }

  const codes = async (examId: string) =>
    (await getAsoReadiness(staff, examId)).items
      .filter((i) => i.severity === "blocking")
      .map((i) => i.code);

  it("empresa do exame vem do servidor (MED-07); exames complementares com data", async () => {
    const exam = await newExam();
    expect(exam.companyId).toBe(I.companyA);
    expect(exam.companyOrigin).toBe("registered");
    // INSERT novo sem company_id (SQL direto) recebe a empresa atual do funcionário.
    const [direct] =
      await admin`insert into health_exams (org_id, employee_id, exam_type, performed_at, aptitude)
      values ('org_a', ${I.employeeA}, 'admissional', '2026-01-05', 'fit') returning company_id, company_origin`;
    expect(direct).toEqual({ company_id: I.companyA, company_origin: "registered" });

    const added = await addProcedure(staff, exam.id, {
      code: "0281",
      performedAt: "2026-10-18",
    });
    expect(added).toMatchObject({
      procedureCode: "0281",
      performedAt: "2026-10-18",
      companyId: I.companyA,
      createdBy: "staff",
    });
    const dup = await addExamProcedureAction(exam.id, {
      code: "0281",
      performedAt: "2026-10-18",
    });
    expect(!dup.ok && dup.error.code).toBe("DUPLICATE");
    const noDescription = await addExamProcedureAction(exam.id, {
      code: "9999",
      performedAt: "2026-10-18",
    });
    expect(!noDescription.ok && noDescription.error.fields?.otherDescription).toMatch(
      /9999/,
    );
    const future = await addExamProcedureAction(exam.id, {
      code: "0281",
      performedAt: "2999-01-01",
    });
    expect(!future.ok && future.error.code).toBe("VALIDATION");
    await addProcedure(staff, exam.id, {
      code: "9999",
      otherDescription: "Exame fictício",
      performedAt: "2026-10-19",
    });
    expect((await listProcedures(staff, exam.id)).map((p) => p.procedureCode)).toEqual([
      "0281",
      "9999",
    ]);
    await removeProcedure(staff, exam.id, added.id);
    expect(await listProcedures(staff, exam.id)).toHaveLength(1);
    await expect(removeProcedure(staff, exam.id, added.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("conferência bloqueia dados incompletos e distingue riscos pendentes de ausência não declarada", async () => {
    const exam = await newExam({ doctorId: undefined, aptitude: "fit" });
    // Riscos ainda pendentes de validação técnica.
    expect(await codes(exam.id)).toEqual(
      expect.arrayContaining(["risks_pending", "examiner_missing"]),
    );
    await validateRisks();
    expect(await codes(exam.id)).not.toContain("risks_pending");
    // Fonte com riscos validados, mas nenhum no GES do funcionário: não presume ausência
    // (MED-09, DT-12). Sem nenhum risco utilizável, o bloqueio é a falta de fonte.
    await admin`insert into ges (id, org_id, company_id, work_unit_id, name) values (${GES_WITHOUT_RISKS}, 'org_a', ${I.companyA}, ${I.workUnitA}, 'GES sem riscos')`;
    await admin`update employees set ges_id=${GES_WITHOUT_RISKS} where id=${I.employeeA}`;
    expect(await codes(exam.id)).toContain("risks_absence_not_declared");
    await admin`update employees set ges_id=${I.gesA} where id=${I.employeeA}`;
    await admin`update medical_risk_entries set status='rejected' where source_id=${sourceId}`;
    expect(await codes(exam.id)).toContain("risk_source");
    await validateRisks();
    // Funcionário sem função / sem GES.
    await admin`update employees set job_role_id=null, ges_id=null where id=${I.employeeA}`;
    expect(await codes(exam.id)).toEqual(
      expect.arrayContaining(["employee_job_role", "employee_ges"]),
    );
    await admin`update employees set job_role_id=${I.jobRoleA}, ges_id=${I.gesA} where id=${I.employeeA}`;
    // Examinador psicólogo não serve; sem CNPJ bloqueia.
    await admin`update health_exams set doctor_id=${PSYCHOLOGIST} where id=${exam.id}`;
    await admin`update companies set cnpj=null where id=${I.companyA}`;
    expect(await codes(exam.id)).toEqual(
      expect.arrayContaining(["examiner_not_physician", "company_document"]),
    );
    await admin`update companies set cnpj='11222333000181' where id=${I.companyA}`;
    await admin`update health_exams set doctor_id=${EXAMINER} where id=${exam.id}`;
    expect(await codes(exam.id)).toEqual([]);
    // Transferência: o exame fica na empresa onde foi feito e não serve à nova (MED-07).
    await admin`update employees set company_id=${COMPANY_C} where id=${I.employeeA}`;
    expect(await codes(exam.id)).toContain("exam_other_company");
    const denied = await generateAsoDocumentAction(exam.id);
    expect(!denied.ok && denied.error.code).toBe("VALIDATION");
    expect(await admin`select * from aso_documents`).toHaveLength(0);
  });

  it("apto com restrição: sem conversão; só o examinador vinculado confirma apto ou inapto", async () => {
    await validateRisks();
    const exam = await newExam();
    expect(await codes(exam.id)).toEqual(["aptitude_confirmation_required"]);
    const denied = await generateAsoDocumentAction(exam.id);
    expect(!denied.ok && denied.error.message).toMatch(
      /médico examinador precisa confirmar/,
    );
    // Equipe, responsável e coordenadora (vinculada a outro médico) não confirmam.
    for (const ctx of [staff, owner, doctor])
      await expect(
        confirmExaminerConclusion(ctx, exam.id, { conclusion: "fit" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      confirmExaminerConclusion(examiner, exam.id, { conclusion: "talvez" }),
    ).rejects.toMatchObject({ name: "ZodError" });
    // Nem por SQL direto: a RLS exige a conta vinculada ao examinador do exame.
    await expect(
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'staff', true)`;
        return tx`insert into aso_examiner_conclusions (org_id, company_id, health_exam_id, conclusion, recorded_aptitude, examiner_medico_id, confirmed_by)
          values ('org_a', ${I.companyA}, ${exam.id}, 'fit', 'fit_with_restrictions', ${EXAMINER}, 'staff')`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
    const confirmed = await confirmExaminerConclusion(examiner, exam.id, {
      conclusion: "fit",
    });
    expect(confirmed).toMatchObject({
      conclusion: "fit",
      recordedAptitude: "fit_with_restrictions",
      examinerMedicoId: EXAMINER,
      confirmedBy: "examiner",
    });
    expect(await codes(exam.id)).toEqual([]);
    // O registro original do exame não muda.
    const [original] = await admin`select aptitude from health_exams where id=${exam.id}`;
    expect(original).toEqual({ aptitude: "fit_with_restrictions" });
    // Trocar o examinador invalida a confirmação anterior.
    await admin`update health_exams set doctor_id=${COORDINATOR} where id=${exam.id}`;
    expect(await codes(exam.id)).toContain("aptitude_confirmation_required");
    await admin`update health_exams set doctor_id=${EXAMINER} where id=${exam.id}`;
    expect(await codes(exam.id)).toEqual([]);
    // Exame sem restrição não usa confirmação.
    const plain = await newExam({ aptitude: "fit" });
    await expect(
      confirmExaminerConclusion(examiner, plain.id, { conclusion: "fit" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("prévia só com dados cadastrados, sem observações clínicas; conclusão confirmada pelo examinador", async () => {
    await validateRisks();
    await approvedPlan();
    const exam = await newExam();
    await confirmExaminerConclusion(examiner, exam.id, { conclusion: "fit" });
    const before = await getAsoReadiness(staff, exam.id);
    expect(before.items.map((i) => i.code)).toEqual(
      expect.arrayContaining(["planned_not_done_0281", "signature_unavailable"]),
    );
    expect(before.checklist.find((c) => c.item === "a")?.status).toBe("ok");
    await addProcedure(staff, exam.id, { code: "0281", performedAt: "2026-10-18" });
    const created = await generateDocument(staff, exam.id);
    expect(created).toMatchObject({
      version: 1,
      status: "preview",
      companyId: I.companyA,
      healthExamId: exam.id,
      generatedBy: "staff",
    });
    const doc = await getDocument(staff, created.id);
    const content = doc.content as AsoContent;
    expect(content.notice).toMatch(/PRÉVIA/);
    expect(content.company).toEqual({ razaoSocial: "A Ltda", cnpj: "11222333000181" });
    expect(content.employee).toEqual({
      fullName: "Func A",
      cpf: "12345678901",
      jobRole: "Pedreiro",
    });
    expect(content.risks).toEqual([
      expect.objectContaining({ description: "Ruído contínuo" }),
    ]);
    expect(content.procedures.complementary).toEqual([
      expect.objectContaining({ procedureCode: "0281", performedAt: "2026-10-18" }),
    ]);
    expect(content.conclusion).toMatchObject({
      result: "fit",
      label: "Apto para a função",
    });
    expect(content.conclusion.basis).toMatch(/Confirmada pelo médico examinador/);
    expect(JSON.stringify(content)).not.toMatch(/restri/i);
    expect(content.coordinator).toMatchObject({
      name: "Dra. Coordenadora Fictícia",
      registration: "CRM 60001/MA",
      rqe: "961",
    });
    expect(content.examiner).toMatchObject({
      name: "Dr. Examinador Fictício",
      registration: "CRM 60002/MA",
      signature: { status: "pending" },
    });
    expect(JSON.stringify(content)).not.toContain(SECRET_NOTE);
    expect(content.warnings.map((w) => w.code)).not.toContain("planned_not_done_0281");
    expect(doc.contentSha256).toBe(asoContentHash(content));
  });

  describe("coordenador na data histórica do exame (2026-10-20)", () => {
    const secondCoordinator = () =>
      admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status)
        values (${COORDINATOR_2}, 'org_a', 'Dr. Segundo Coordenador Fictício', '60004', 'physician', 'MA', '962', 'internal', 'active')`;
    const assign = (startsOn: string, endsOn: string | null) =>
      admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, ends_on, end_reason, created_by)
        values ('org_a', ${I.companyA}, ${COORDINATOR_2}, ${startsOn}, ${endsOn}, ${endsOn ? "Encerramento fictício." : null}, 'owner')`;
    const endBase = (endsOn: string) =>
      admin`update pcmso_coordinator_assignments set ends_on=${endsOn}, end_reason='Troca fictícia.' where medico_id=${COORDINATOR}`;
    const composedCoordinator = async () => {
      const exam = await newExam({ aptitude: "unfit" });
      const created = await generateDocument(staff, exam.id);
      return ((await getDocument(staff, created.id)).content as AsoContent).coordinator;
    };

    beforeEach(async () => {
      await validateRisks();
      await secondCoordinator();
    });

    it("troca antes do exame: o ASO nomeia quem estava em vigor na data do exame", async () => {
      await endBase("2026-06-30");
      await assign("2026-07-01", null);
      expect(await composedCoordinator()).toMatchObject({
        name: "Dr. Segundo Coordenador Fictício",
      });
    });

    it("designação que só começa depois do exame não conta; a anterior segue no ASO", async () => {
      await endBase("2026-10-31");
      await assign("2026-11-01", null);
      expect(await composedCoordinator()).toMatchObject({
        name: "Dra. Coordenadora Fictícia",
      });
    });

    it("fim inclusivo: encerrada no próprio dia do exame ainda é a responsável", async () => {
      await endBase("2026-10-20");
      await assign("2026-10-21", null);
      expect(await composedCoordinator()).toMatchObject({
        name: "Dra. Coordenadora Fictícia",
      });
    });

    it("sem designação em vigor na data: aviso (NR-7 pede o nome 'se houver'), sem inventar médico", async () => {
      await admin`update pcmso_coordinator_assignments set starts_on='2026-11-01' where medico_id=${COORDINATOR}`;
      const exam = await newExam({ aptitude: "unfit" });
      const readiness = await getAsoReadiness(staff, exam.id);
      expect(readiness.items.map((i) => i.code)).toContain("coordinator_missing");
      expect(await codes(exam.id)).not.toContain("coordinator_overlap");
      const created = await generateDocument(staff, exam.id);
      expect(
        ((await getDocument(staff, created.id)).content as AsoContent).coordinator,
      ).toBeNull();
    });

    it("duas designações em vigor na data do exame: bloqueia sem escolher; a prévia arquivada não muda", async () => {
      const exam = await newExam({ aptitude: "unfit" });
      const archived = await generateDocument(staff, exam.id);
      const before = await getDocument(staff, archived.id);
      // Sobreposição só alcançável fora do app (o app recusa períodos sobrepostos).
      await assign("2026-10-01", "2026-10-31");
      expect(await codes(exam.id)).toContain("coordinator_overlap");
      await expect(generateDocument(staff, exam.id)).rejects.toMatchObject({
        code: "VALIDATION",
        message: expect.stringMatching(/mais de uma designação/),
      });
      expect((await listDocuments(staff, exam.id)).map((d) => d.version)).toEqual([1]);
      const after = await getDocument(staff, archived.id);
      expect(after.content).toEqual(before.content);
      expect(after.contentSha256).toBe(before.contentSha256);
    });
  });

  it("versões imutáveis; RLS exige examinador; só prévia; histórico bloqueia exclusão", async () => {
    await validateRisks();
    const exam = await newExam({ aptitude: "unfit" });
    const v1 = await generateDocument(staff, exam.id);
    const v2 = await generateDocument(staff, exam.id);
    expect(v2.version).toBe(2);
    expect((await listDocuments(staff, exam.id)).map((d) => d.version)).toEqual([2, 1]);
    expect(
      ((await getDocument(staff, v1.id)).content as AsoContent).conclusion.label,
    ).toBe("Inapto para a função (informado no cadastro do exame)");
    const asStaff = (fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'staff', true)`;
        return fn(tx);
      });
    await expect(
      asStaff((tx) => tx`update aso_documents set content='{}' where id=${v1.id}`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asStaff((tx) => tx`delete from aso_documents where id=${v1.id}`),
    ).rejects.toMatchObject({ code: "42501" });
    const noExaminer = await newExam({ doctorId: undefined }, { clinicalNote: false });
    await expect(
      asStaff(
        (tx) =>
          tx`insert into aso_documents (org_id, company_id, health_exam_id, version, content, content_sha256, generated_by)
            values ('org_a', ${I.companyA}, ${noExaminer.id}, 1, '{}', ${"a".repeat(64)}, 'staff')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asStaff(
        (tx) =>
          tx`insert into aso_documents (org_id, company_id, health_exam_id, version, status, content, content_sha256, generated_by)
            values ('org_a', ${I.companyA}, ${exam.id}, 9, 'issued', '{}', ${"a".repeat(64)}, 'staff')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(deleteHealthExam("org_a", exam.id)).rejects.toMatchObject({
      code: "IN_USE",
    });
    await expect(deleteEmployee("org_a", I.employeeA)).rejects.toMatchObject({
      code: "IN_USE",
    });
    // Exame sem prévia continua excluível.
    expect(await deleteHealthExam("org_a", noExaminer.id)).toBe(true);
  });

  it("isolamento, módulo e perfil cliente; REST", async () => {
    await validateRisks();
    const exam = await newExam({ aptitude: "fit" });
    const params = { params: Promise.resolve({ id: exam.id }) };
    const added = await ADD_PROCEDURE(
      req(staff, "POST", { code: "0281", performedAt: "2026-10-18" }),
      params,
    );
    expect(added.status).toBe(201);
    const { id: procedureId } = await added.json();
    expect((await LIST_PROCEDURES(req(staff), params)).status).toBe(200);
    expect((await READINESS(req(staff), params)).status).toBe(200);
    const created = await GENERATE(req(staff, "POST"), params);
    expect(created.status).toBe(201);
    const { id: docId } = await created.json();
    expect((await LIST_DOCS(req(staff), params)).status).toBe(200);
    const shown = await SHOW_DOC(req(staff), { params: Promise.resolve({ id: docId }) });
    expect(shown.status).toBe(200);
    expect(JSON.stringify(await shown.json())).not.toContain(SECRET_NOTE);
    expect(
      (
        await REMOVE_PROCEDURE(req(staff, "DELETE"), {
          params: Promise.resolve({ id: exam.id, procedureId }),
        })
      ).status,
    ).toBe(204);
    // Outro tenant e perfil cliente.
    expect((await READINESS(req(ownerB), params)).status).toBe(404);
    expect(
      (await SHOW_DOC(req(ownerB), { params: Promise.resolve({ id: docId }) })).status,
    ).toBe(404);
    expect((await READINESS(req({ ...owner, role: "client" }), params)).status).toBe(403);
    await expect(getAsoReadiness(ownerB, exam.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Medicina desligada na empresa: nada visível.
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    await expect(listDocuments(staff, exam.id)).rejects.toMatchObject({
      code: expect.stringMatching(/NOT_FOUND|FORBIDDEN/),
    });
    await expect(getDocument(staff, docId)).rejects.toMatchObject({
      code: expect.stringMatching(/NOT_FOUND|FORBIDDEN/),
    });
  });

  it("exame antigo sem origem e transferências: nada é presumido (MED-07)", async () => {
    await validateRisks();
    // Exame anterior ao controle: sem empresa, mesmo com o funcionário ainda na empresa A.
    const legacy = await legacyExam();
    expect(legacy).toMatchObject({ company_id: null, company_origin: null });
    expect(await codes(legacy.id)).toEqual(["exam_company_unverified"]);
    await expect(
      addProcedure(staff, legacy.id, { code: "0281", performedAt: "2026-03-08" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(generateDocument(staff, legacy.id)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    // Nem por SQL direto: a RLS da prévia exige a empresa do exame.
    await expect(
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'staff', true)`;
        return tx`insert into aso_documents (org_id, company_id, health_exam_id, version, content, content_sha256, generated_by)
          values ('org_a', ${I.companyA}, ${legacy.id}, 1, '{}', ${"a".repeat(64)}, 'staff')`;
      }),
    ).rejects.toMatchObject({ code: "42501" });

    // Confirmação: só o responsável, com justificativa; registra autor e motivo.
    await expect(
      confirmCompanyOrigin(staff, legacy.id, {
        justification: "Prontuário da clínica fictícia.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      confirmCompanyOrigin(owner, legacy.id, { justification: "curta" }),
    ).rejects.toMatchObject({ name: "ZodError" });
    const confirmed = await confirmCompanyOrigin(owner, legacy.id, {
      justification: "Prontuário da clínica fictícia indica a empresa A.",
    });
    expect(confirmed).toMatchObject({
      companyId: I.companyA,
      companyOrigin: "confirmed",
    });
    const [row] =
      await admin`select company_origin_confirmed_by, company_origin_note from health_exams where id=${legacy.id}`;
    expect(row).toEqual({
      company_origin_confirmed_by: "owner",
      company_origin_note: "Prontuário da clínica fictícia indica a empresa A.",
    });
    expect(await codes(legacy.id)).toEqual([]);
    await expect(
      confirmCompanyOrigin(owner, legacy.id, {
        justification: "Segunda confirmação fictícia.",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Depois de registrada, a empresa de origem não muda nem por SQL.
    await expect(
      admin`update health_exams set company_id=${COMPANY_C} where id=${legacy.id}`,
    ).rejects.toMatchObject({ code: "23514" });

    // Transferência: o exame registrado fica na empresa A e não serve à C; o antigo sem
    // origem continua sem origem; um exame novo nasce na empresa C.
    const registered = await newExam({ aptitude: "fit" });
    const legacyBeforeTransfer = await legacyExam();
    await admin`update employees set company_id=${COMPANY_C} where id=${I.employeeA}`;
    expect(await codes(registered.id)).toContain("exam_other_company");
    expect(await codes(legacy.id)).toContain("exam_other_company");
    expect(await codes(legacyBeforeTransfer.id)).toContain("exam_company_unverified");
    const [after] =
      await admin`select company_id from health_exams where id=${legacyBeforeTransfer.id}`;
    expect(after.company_id).toBeNull();
    const fresh = await newExam({ aptitude: "fit" });
    expect(fresh.companyId).toBe(COMPANY_C);

    // REST: confirmação de origem (owner) e confirmação do examinador.
    const params = { params: Promise.resolve({ id: legacyBeforeTransfer.id }) };
    expect(
      (
        await CONFIRM_ORIGIN(
          req(staff, "POST", { justification: "Tentativa da equipe." }),
          params,
        )
      ).status,
    ).toBe(403);
    const ok = await CONFIRM_ORIGIN(
      req(owner, "POST", { justification: "Registro fictício confirma a empresa C." }),
      params,
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).companyId).toBe(COMPANY_C);
    const restricted = await newExam();
    const restrictedParams = { params: Promise.resolve({ id: restricted.id }) };
    expect(
      (
        await CONFIRM_CONCLUSION(
          req(staff, "POST", { conclusion: "fit" }),
          restrictedParams,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await CONFIRM_CONCLUSION(
          req(examiner, "POST", { conclusion: "unfit" }),
          restrictedParams,
        )
      ).status,
    ).toBe(201);
    expect((await LIST_CONCLUSIONS(req(staff), restrictedParams)).status).toBe(200);
    expect((await LIST_CONCLUSIONS(req(ownerB), restrictedParams)).status).toBe(404);
  });
});
