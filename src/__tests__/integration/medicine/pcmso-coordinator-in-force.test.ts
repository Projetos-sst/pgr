/**
 * Coordenador do PCMSO **vigente na data de referência** (NOB-109/NOB-144/NOB-151) contra
 * Postgres efêmero. A conferência (NOB-148) e a prévia (NOB-151) usam o coordenador em vigor hoje
 * (America/Sao_Paulo), não a designação "aberta": encerramento agendado não tira quem segue vigente;
 * sucessor agendado não entra antes do início; designação futura ou já encerrada não conta;
 * sobreposição (só alcançável fora do app) bloqueia sem escolher uma. Prévias arquivadas não mudam.
 * Fluxo real de plano aprovado pela coordenadora vinculada (mesmo setup de `pcmso-documents`).
 * Datas relativas ao dia real da execução. Dados fictícios.
 */
import type postgres from "postgres";
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
import { todayInSaoPaulo } from "@/shared/dates";
import { addDays } from "@/shared/domains/medicine/nr7-schedule-rules";
import type { PcmsoContent } from "@/shared/domains/medicine/pcmso-composition";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import { linkByInvitation as link } from "../_helpers/professional-link";
import {
  approve,
  createDraft,
  decideItem,
  getPlan,
} from "@/shared/server/medicine/exam-plan-core";
import {
  closeCoordinator,
  designateCoordinator,
} from "@/shared/server/medicine/pcmso-coordinator-core";
import {
  generateDocument,
  getDocument,
  listDocuments,
} from "@/shared/server/medicine/pcmso-document-core";
import { getPcmsoReadiness } from "@/shared/server/medicine/pcmso-readiness-core";
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
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000041";
const SUCCESSOR = "aaaaaaaa-0000-4000-8000-000000000042";
const MEDICO_B = "bbbbbbbb-0000-4000-8000-000000000041";
const CURRENT_NAME = "Dra. Coordenadora Vigente Fictícia";
const SUCCESSOR_NAME = "Dr. Sucessor Agendado Fictício";

const blocking = (r: Awaited<ReturnType<typeof getPcmsoReadiness>>) =>
  r.items.filter((i) => i.severity === "blocking").map((i) => i.code);

(enabled ? describe : describe.skip)(
  "PCMSO: coordenador vigente na data de referência (NOB-109)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let today: string;
    const day = (offset: number) => addDays(today, offset);
    const originalEnv = { ...process.env };

    beforeAll(async () => {
      admin = adminClient();
      await admin`set client_min_messages = warning`;
      await applyMigrations(admin);
    });
    afterAll(async () => {
      process.env = originalEnv;
      await admin?.end({ timeout: 5 });
    });
    beforeEach(async () => {
      jest.clearAllMocks();
      today = todayInSaoPaulo();
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('owner-b','ob@example.test')`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','collaborator'),('org_a','doctor','collaborator'),('org_b','owner-b','owner')`;
      await admin`update companies set cnae='4120-4', main_activity='Construção de edifícios', risk_grade=3 where id=${I.companyA}`;
      await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status) values
        (${MEDICO}, 'org_a', ${CURRENT_NAME}, '60041', 'physician', 'MA', '941', 'internal', 'active'),
        (${SUCCESSOR}, 'org_a', ${SUCCESSOR_NAME}, '60042', 'physician', 'MA', '942', 'external', 'active'),
        (${MEDICO_B}, 'org_b', 'Dra. Outro Escritório Fictícia', '60043', 'physician', 'MA', '943', 'internal', 'active')`;
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

    /** Plano aprovado pela coordenadora vinculada enquanto a designação dela está aberta. */
    async function approvedPlan() {
      const plan = await createDraft(staff, I.companyA);
      const [item] = (await getPlan(staff, plan.id)).items;
      await decideItem(doctor, plan.id, item.id, {
        decision: "kept",
        periodicity: "Admissional, anual e demissional",
      });
      return approve(doctor, plan.id, { note: "Aprovação fictícia." });
    }

    const currentAssignmentId = async () => {
      const [row] =
        await admin`select id from pcmso_coordinator_assignments where medico_id=${MEDICO}`;
      return row.id as string;
    };

    const previewCoordinator = async () => {
      const created = await generateDocument(staff, I.companyA, { cycleStart: today });
      const doc = await getDocument(staff, created.id);
      return (doc.content as PcmsoContent).coordinator;
    };

    const docCount = async () =>
      (await admin`select id from pcmso_documents where company_id=${I.companyA}`).length;

    it("coordenadora vigente hoje: conferência sem bloqueio e prévia em nome dela", async () => {
      await approvedPlan();
      expect(blocking(await getPcmsoReadiness(staff, I.companyA))).toEqual([]);
      expect(await previewCoordinator()).toMatchObject({
        name: CURRENT_NAME,
        crm: "60041",
      });
    });

    it("encerramento agendado para o mês que vem: segue vigente na conferência e na prévia", async () => {
      await approvedPlan();
      await closeCoordinator(owner, await currentAssignmentId(), {
        endsOn: day(30),
        endReason: "Encerramento agendado fictício.",
      });
      // Antes da correção: a designação deixava de ser "aberta" e a conferência bloqueava já hoje.
      expect(blocking(await getPcmsoReadiness(staff, I.companyA))).toEqual([]);
      expect(await previewCoordinator()).toMatchObject({ name: CURRENT_NAME });
    });

    it("sucessor designado a partir de amanhã: a prévia de hoje nomeia a vigente, não o futuro", async () => {
      await approvedPlan();
      // Fluxo real da troca: encerra a atual na véspera do início do sucessor (hoje).
      await designateCoordinator(owner, I.companyA, {
        medicoId: SUCCESSOR,
        startsOn: day(1),
      });
      const [current] =
        await admin`select ends_on::text as ends_on from pcmso_coordinator_assignments where medico_id=${MEDICO}`;
      expect(current.ends_on).toBe(today);
      expect(blocking(await getPcmsoReadiness(staff, I.companyA))).toEqual([]);
      const coordinator = await previewCoordinator();
      expect(coordinator).toMatchObject({ name: CURRENT_NAME, crm: "60041" });
      expect(coordinator.name).not.toBe(SUCCESSOR_NAME);
    });

    it("designação que só começa no futuro não conta: bloqueia a conferência e a prévia", async () => {
      await approvedPlan();
      await admin`update pcmso_coordinator_assignments set starts_on=${day(1)} where medico_id=${MEDICO}`;
      expect(blocking(await getPcmsoReadiness(staff, I.companyA))).toEqual([
        "coordinator",
      ]);
      await expect(
        generateDocument(staff, I.companyA, { cycleStart: today }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await docCount()).toBe(0);
    });

    it("designação encerrada ontem não conta: bloqueia a conferência e a prévia", async () => {
      await approvedPlan();
      await closeCoordinator(owner, await currentAssignmentId(), {
        endsOn: day(-1),
        endReason: "Encerramento fictício já ocorrido.",
      });
      expect(blocking(await getPcmsoReadiness(staff, I.companyA))).toEqual([
        "coordinator",
      ]);
      await expect(
        generateDocument(staff, I.companyA, { cycleStart: today }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await docCount()).toBe(0);
    });

    it("sobreposição: o app recusa; inserida fora do app, bloqueia sem escolher uma", async () => {
      await approvedPlan();
      // O repositório impede períodos sobrepostos (início no mesmo dia ou antes da aberta).
      await expect(
        designateCoordinator(owner, I.companyA, {
          medicoId: SUCCESSOR,
          startsOn: "2026-01-01",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      // O banco não tem EXCLUDE de períodos: por SQL direto (fora do app) a sobreposição existe.
      await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, ends_on, end_reason, created_by, ended_by)
        values ('org_a', ${I.companyA}, ${SUCCESSOR}, '2026-06-01', ${day(10)}, 'Sobreposição fictícia fora do app.', 'owner', 'owner')`;
      expect(blocking(await getPcmsoReadiness(staff, I.companyA))).toEqual([
        "coordinator_overlap",
      ]);
      await expect(
        generateDocument(staff, I.companyA, { cycleStart: today }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await docCount()).toBe(0);
    });

    it("prévia já arquivada não muda com a troca agendada; a nova também nomeia a vigente", async () => {
      await approvedPlan();
      const v1 = await generateDocument(staff, I.companyA, { cycleStart: today });
      const before = await getDocument(staff, v1.id);
      await designateCoordinator(owner, I.companyA, {
        medicoId: SUCCESSOR,
        startsOn: day(1),
      });
      const v2 = await generateDocument(staff, I.companyA, { cycleStart: today });
      const after = await getDocument(staff, v1.id);
      expect(after.content).toEqual(before.content);
      expect(after.contentSha256).toBe(before.contentSha256);
      expect((await listDocuments(staff, I.companyA)).map((d) => d.version)).toEqual([
        2, 1,
      ]);
      const v2Doc = await getDocument(staff, v2.id);
      expect((v2Doc.content as PcmsoContent).coordinator).toMatchObject({
        name: CURRENT_NAME,
      });
    });

    it("isolamento: outro tenant não lê a conferência, e o coordenador dele não supre o desta empresa", async () => {
      await approvedPlan();
      await admin`update pcmso_coordinator_assignments set starts_on=${day(1)} where medico_id=${MEDICO}`;
      await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
        values ('org_b', ${I.companyB}, ${MEDICO_B}, '2026-01-01', 'owner-b')`;
      await expect(getPcmsoReadiness(ownerB, I.companyA)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(blocking(await getPcmsoReadiness(staff, I.companyA))).toEqual([
        "coordinator",
      ]);
      const other = await getPcmsoReadiness(ownerB, I.companyB);
      expect(blocking(other)).not.toContain("coordinator");
      expect(blocking(other)).not.toContain("coordinator_overlap");
    });
  },
);
