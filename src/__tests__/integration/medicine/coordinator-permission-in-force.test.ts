/**
 * Permissão do coordenador do PCMSO = designação EM VIGOR HOJE (America/Sao_Paulo), não a
 * designação "aberta" (NOB-109/NOB-144/NOB-149), contra Postgres efêmero. Para os três atos de
 * escrita do coordenador — aprovar o plano de exames, registrar critérios de interpretação e
 * registrar o PCMSO assinado (fluxo do coordenador) — confere o core/Server Action, o REST e o SQL
 * direto como `app_runtime` (a RLS repete a regra):
 * - em vigor; começa amanhã (nega); encerrada ontem (nega); termina hoje e termina amanhã
 *   (permite: encerramento agendado mantém o poder até o fim);
 * - sucessor agendado: a atual pode até o fim, o sucessor só a partir do início;
 * - sobreposição inserida fora do app: nega para os dois (falha fechada, sem escolher um);
 * - vínculo revogado, identidade revogada, médico de outra empresa, outro tenant e owner sem
 *   identidade médica: negam.
 * As sondagens por SQL rodam em transação desfeita (ROLLBACK), sem alterar o estado do caso.
 * Storage simulado. Datas relativas ao dia real da execução. Dados fictícios.
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
jest.mock("@/shared/integrations/storage/documents-storage", () => {
  const actual = jest.requireActual("@/shared/integrations/storage/documents-storage");
  return {
    signedPcmsoPath: actual.signedPcmsoPath,
    SIGNED_DOWNLOAD_URL_TTL_SECONDS: actual.SIGNED_DOWNLOAD_URL_TTL_SECONDS,
    putSignedAsoObject: jest.fn(),
    removeDocumentObject: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
  };
});
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import { addDays } from "@/shared/domains/medicine/nr7-schedule-rules";
import {
  putSignedAsoObject,
  removeDocumentObject,
} from "@/shared/integrations/storage/documents-storage";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import {
  approve,
  createDraft,
  decideItem,
  getPlan,
} from "@/shared/server/medicine/exam-plan-core";
import { defineCriteria } from "@/shared/server/medicine/interpretation-criteria-core";
import { designateCoordinator } from "@/shared/server/medicine/pcmso-coordinator-core";
import { generateDocument } from "@/shared/server/medicine/pcmso-document-core";
import { registerSignedPcmso } from "@/shared/server/medicine/pcmso-signed-core";
import { approveExamPlanAction } from "@/shared/server/actions/medicine/exam-plans";
import { defineInterpretationCriteriaAction } from "@/shared/server/actions/medicine/interpretation-criteria";
import { registerSignedPcmsoAction } from "@/shared/server/actions/medicine/pcmso-documents";
import { POST as APPROVE } from "@/app/api/v1/exam-plans/[id]/approval/route";
import { POST as DEFINE } from "@/app/api/v1/companies/[id]/interpretation-criteria/route";
import { POST as REGISTER } from "@/app/api/v1/companies/[id]/signed-pcmsos/route";
import { linkByInvitation as link } from "../_helpers/professional-link";
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
const doctor2: TenantContext = { ...owner, userId: "doctor2", role: "collaborator" };
const doctor3: TenantContext = { ...owner, userId: "doctor3", role: "collaborator" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
// Coordenadora da empresa A (conta `doctor`), sucessor (conta `doctor2`) e coordenador da
// empresa C (conta `doctor3`), todos com vínculo por convite e identidade verificada.
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000071";
const SUCCESSOR = "aaaaaaaa-0000-4000-8000-000000000072";
const MEDICO_C = "aaaaaaaa-0000-4000-8000-000000000073";
const COMPANY_C = "cccccccc-0000-4000-8000-000000000074";
const CRM: Record<string, string> = {
  [MEDICO]: "62001",
  [SUCCESSOR]: "62002",
  [MEDICO_C]: "62003",
};
const NAME: Record<string, string> = {
  [MEDICO]: "Dra. Coordenadora Vigente Fictícia",
  [SUCCESSOR]: "Dr. Sucessor Agendado Fictício",
  [MEDICO_C]: "Dr. Coordenador da Empresa C Fictício",
};
const CRITERIA = {
  code: "0281",
  criteria: "Critério fictício da coordenadora em vigor.",
  conduct: "Conduta fictícia da coordenadora em vigor.",
};

type Actor = { ctx: TenantContext; medicoId: string };
const DOCTOR: Actor = { ctx: doctor, medicoId: MEDICO };
const DOCTOR2: Actor = { ctx: doctor2, medicoId: SUCCESSOR };

const pdf = (text = "PCMSO assinado fictício") =>
  new File([`%PDF-1.7\n${text}\n%%EOF`], "pcmso.pdf", { type: "application/pdf" });

const jsonReq = (ctx: TenantContext, body: unknown) =>
  new NextRequest("http://localhost/api/v1", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });
const formReq = (ctx: TenantContext, form: FormData) =>
  new NextRequest("http://localhost/api/v1", {
    method: "POST",
    body: form,
    headers: {
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

const ROLLBACK = new Error("rollback da sondagem");
const DENIED_CORE = { code: expect.stringMatching(/^(FORBIDDEN|VALIDATION)$/) };

(enabled ? describe : describe.skip)(
  "Permissão do coordenador = designação em vigor hoje (NOB-109/NOB-144/NOB-149)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;
    let today: string;
    const day = (offset: number) => addDays(today, offset);
    const originalEnv = { ...process.env };
    // Plano aprovado v1, prévia v1 (do plano v1) e rascunho v2 de cada caso.
    let v1: { id: string };
    let preview: { id: string; contentSha256: string };
    let v2: { id: string };

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
      for (const fn of [putSignedAsoObject, removeDocumentObject])
        (fn as jest.Mock).mockResolvedValue(undefined);
      today = todayInSaoPaulo();
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('doctor2','d2@example.test'),('doctor3','d3@example.test'),('owner-b','ob@example.test')`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','collaborator'),('org_a','doctor','collaborator'),('org_a','doctor2','collaborator'),('org_a','doctor3','collaborator'),('org_b','owner-b','owner')`;
      await admin`update companies set cnae='4120-4', main_activity='Construção de edifícios', risk_grade=3 where id=${I.companyA}`;
      await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status) values
        (${MEDICO}, 'org_a', ${NAME[MEDICO]}, ${CRM[MEDICO]}, 'physician', 'MA', '971', 'internal', 'active'),
        (${SUCCESSOR}, 'org_a', ${NAME[SUCCESSOR]}, ${CRM[SUCCESSOR]}, 'physician', 'MA', '972', 'external', 'active'),
        (${MEDICO_C}, 'org_a', ${NAME[MEDICO_C]}, ${CRM[MEDICO_C]}, 'physician', 'MA', '973', 'external', 'active')`;
      await admin`insert into companies (id, org_id, cnpj, razao_social) values (${COMPANY_C}, 'org_a', '33444555000177', 'C Fictícia Ltda')`;
      await admin`insert into company_modules (org_id, company_id, module, enabled) values ('org_a', ${COMPANY_C}, 'medicine', true)`;
      await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by) values
        ('org_a', ${I.companyA}, ${MEDICO}, '2026-01-01', 'owner'),
        ('org_a', ${COMPANY_C}, ${MEDICO_C}, '2026-01-01', 'owner')`;
      await admin`update risks set noxious_agent_code='02.01.001', possible_injuries='Perda auditiva induzida por ruído' where id=${I.riskA}`;
      const source = await registerMedicalRiskSource(owner, I.companyA, {
        kind: "internal",
        pgrId: I.pgrA,
      });
      await admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${source.id}`;
      await link(owner, MEDICO, { userId: "doctor", reason: "Coordenadora fictícia." });
      await link(owner, SUCCESSOR, { userId: "doctor2", reason: "Sucessor fictício." });
      await link(owner, MEDICO_C, {
        userId: "doctor3",
        reason: "Coordenador fictício da C.",
      });
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
      (requireOfficeStaff as jest.Mock).mockResolvedValue(staff);

      // Base do caso, com a coordenadora em vigor: plano v1 aprovado, prévia v1 e rascunho v2.
      const draft = await createDraft(staff, I.companyA);
      const [item] = (await getPlan(staff, draft.id)).items;
      await decideItem(doctor, draft.id, item.id, {
        decision: "kept",
        periodicity: "Admissional, anual e demissional",
      });
      v1 = await approve(doctor, draft.id, { note: "Aprovação fictícia." });
      preview = await generateDocument(staff, I.companyA, { cycleStart: today });
      v2 = await createDraft(staff, I.companyA);
    });

    const fields = (medicoId: string) => ({
      origin: "coordinator",
      previewDocumentId: preview.id,
      signatureMethod: "icp_brasil",
      verificationReference: "Verificador ITI, relatório fictício 71",
      signerName: NAME[medicoId],
      signerRegistration: CRM[medicoId],
      signerUf: "MA",
      signedOn: today,
    });

    /**
     * Executa como `app_runtime` (org e ator da sessão) e desfaz. "allowed" = linhas afetadas;
     * "denied" = nenhuma linha (USING) ou recusa da RLS (WITH CHECK, 42501).
     */
    async function sqlOutcome(
      actor: string,
      fn: (tx: postgres.TransactionSql) => Promise<{ length: number }>,
      org = "org_a",
    ): Promise<"allowed" | "denied"> {
      let affected = 0;
      try {
        await runtime.begin(async (tx) => {
          await tx`select set_config('app.current_org', ${org}, true), set_config('app.current_actor', ${actor}, true)`;
          affected = (await fn(tx)).length;
          throw ROLLBACK;
        });
      } catch (error) {
        if (error === ROLLBACK) return affected > 0 ? "allowed" : "denied";
        if ((error as { code?: string }).code === "42501") return "denied";
        throw error;
      }
      throw new Error("Sondagem sem ROLLBACK.");
    }

    /** Aprovar o v2 por SQL; substitui o v1 antes, como o app (um aprovado por empresa). */
    const sqlApprove = (actor: string, medicoId: string, org?: string) =>
      sqlOutcome(
        actor,
        async (tx) => {
          await tx`update medical_exam_plans set status='superseded' where id=${v1.id} returning id`;
          return tx`update medical_exam_plans set status='approved', approved_by_user=${actor},
            approved_by_medico_id=${medicoId}, approved_at=now() where id=${v2.id} returning id`;
        },
        org,
      );
    const sqlCriteria = (actor: string, medicoId: string, org?: string) =>
      sqlOutcome(
        actor,
        (tx) =>
          tx`insert into pcmso_interpretation_criteria (org_id, company_id, procedure_code, version, criteria, conduct, authored_by_medico_id, authored_by_user)
            values ('org_a', ${I.companyA}, '0281', 99, 'Critério fictício por SQL.', 'Conduta fictícia por SQL.', ${medicoId}, ${actor}) returning id`,
        org,
      );
    const sqlSigned = (actor: string, medicoId: string, org?: string) =>
      sqlOutcome(
        actor,
        (tx) =>
          tx`insert into pcmso_signed_documents (id, org_id, company_id, preview_document_id, preview_sha256, exam_plan_id,
            origin, signature_method, signer_name, signer_registration, signer_uf, signed_on, verification_reference,
            storage_path, file_sha256, size_bytes, registered_by)
          values (gen_random_uuid(), 'org_a', ${I.companyA}, ${preview.id}, ${preview.contentSha256}, ${v1.id},
            'coordinator', 'icp_brasil', ${NAME[medicoId]}, ${CRM[medicoId]}, 'MA', ${today}, 'Sondagem fictícia por SQL',
            ${"org_a/sondagem/" + Math.random()}, ${"a".repeat(64)}, 10, ${actor}) returning id`,
        org,
      );

    /** As três sondagens por SQL para um ator. */
    const sqlAll = async ({ ctx, medicoId }: Actor, org?: string) => ({
      approve: await sqlApprove(ctx.userId, medicoId, org),
      criteria: await sqlCriteria(ctx.userId, medicoId, org),
      signed: await sqlSigned(ctx.userId, medicoId, org),
    });
    const ALLOWED = { approve: "allowed", criteria: "allowed", signed: "allowed" };
    const DENIED = { approve: "denied", criteria: "denied", signed: "denied" };

    const countOf = async (table: string) => {
      const [row] =
        await admin`select count(*)::int as n from ${admin(table)} where company_id = ${I.companyA}`;
      return row.n as number;
    };
    const signedCount = () => countOf("pcmso_signed_documents");
    const criteriaCount = () => countOf("pcmso_interpretation_criteria");
    const planStatus = async (id: string) => {
      const [row] = await admin`select status from medical_exam_plans where id = ${id}`;
      return row.status as string;
    };

    /** Core: os três atos recusados para o ator, e nada gravado. */
    async function expectCoreDenied({ ctx, medicoId }: Actor) {
      await expect(
        registerSignedPcmso(ctx, I.companyA, fields(medicoId), pdf()),
      ).rejects.toMatchObject(DENIED_CORE);
      await expect(defineCriteria(ctx, I.companyA, CRITERIA)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(approve(ctx, v2.id, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await signedCount()).toBe(0);
      expect(await criteriaCount()).toBe(0);
      expect(await planStatus(v2.id)).toBe("draft");
    }

    /** Core: os três atos aceitos para o ator, em nome do médico dele. */
    async function expectCoreAllowed({ ctx, medicoId }: Actor) {
      const signed = await registerSignedPcmso(ctx, I.companyA, fields(medicoId), pdf());
      expect(signed).toMatchObject({ origin: "coordinator", registeredBy: ctx.userId });
      const criterion = await defineCriteria(ctx, I.companyA, CRITERIA);
      expect(criterion).toMatchObject({
        authoredByMedicoId: medicoId,
        authoredByUser: ctx.userId,
      });
      // Por último: aprovar o v2 substitui o v1, de que a prévia depende.
      const approved = await approve(ctx, v2.id, { note: "Aprovação fictícia do v2." });
      expect(approved).toMatchObject({
        status: "approved",
        approvedByUser: ctx.userId,
        approvedByMedicoId: medicoId,
      });
    }

    const setMedico = (sets: { startsOn?: string; endsOn?: string }) =>
      admin`update pcmso_coordinator_assignments set
        starts_on = coalesce(${sets.startsOn ?? null}::date, starts_on),
        ends_on = ${sets.endsOn ?? null}::date,
        end_reason = ${sets.endsOn ? "Encerramento fictício." : null},
        ended_by = ${sets.endsOn ? "owner" : null}
        where medico_id = ${MEDICO} and company_id = ${I.companyA}`;

    type Scenario = {
      name: string;
      arrange: () => Promise<unknown>;
      allowed: Actor | null;
      denied: Actor[];
    };
    const SCENARIOS: Scenario[] = [
      {
        name: "em vigor (desde 2026-01-01, sem fim): a coordenadora age",
        arrange: async () => undefined,
        allowed: DOCTOR,
        denied: [DOCTOR2],
      },
      {
        name: "começa amanhã: ninguém age hoje",
        arrange: () => setMedico({ startsOn: day(1) }),
        allowed: null,
        denied: [DOCTOR, DOCTOR2],
      },
      {
        name: "encerrada ontem: ninguém age",
        arrange: () => setMedico({ endsOn: day(-1) }),
        allowed: null,
        denied: [DOCTOR, DOCTOR2],
      },
      {
        name: "termina hoje (fim inclusivo): a coordenadora ainda age",
        arrange: () => setMedico({ endsOn: today }),
        allowed: DOCTOR,
        denied: [DOCTOR2],
      },
      {
        name: "termina amanhã (encerramento agendado): a coordenadora ainda age",
        arrange: () => setMedico({ endsOn: day(1) }),
        allowed: DOCTOR,
        denied: [DOCTOR2],
      },
      {
        name: "sucessor agendado para amanhã: a atual age até hoje; o sucessor ainda não",
        arrange: () =>
          designateCoordinator(owner, I.companyA, {
            medicoId: SUCCESSOR,
            startsOn: day(1),
          }),
        allowed: DOCTOR,
        denied: [DOCTOR2],
      },
      {
        name: "sobreposição inserida fora do app: nega para os dois, sem escolher um",
        arrange: () =>
          admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, ends_on, end_reason, created_by, ended_by)
            values ('org_a', ${I.companyA}, ${SUCCESSOR}, '2026-06-01', ${day(10)}, 'Sobreposição fictícia fora do app.', 'owner', 'owner')`,
        allowed: null,
        denied: [DOCTOR, DOCTOR2],
      },
    ];

    it.each(SCENARIOS.map((s) => [s.name, s] as const))(
      "%s (core e SQL direto)",
      async (_name, scenario) => {
        await scenario.arrange();
        // Antes da correção a permissão seguia a designação "aberta" (`ends_on` nulo): encerramento
        // agendado tirava o poder hoje, sucessor agendado já o tinha e a sobreposição não negava.
        if (scenario.allowed) expect(await sqlAll(scenario.allowed)).toEqual(ALLOWED);
        for (const actor of scenario.denied) expect(await sqlAll(actor)).toEqual(DENIED);
        for (const actor of scenario.denied) await expectCoreDenied(actor);
        if (scenario.allowed) await expectCoreAllowed(scenario.allowed);
      },
    );

    it("Server Action e REST seguem a mesma regra (sucessor agendado e encerramento agendado)", async () => {
      await designateCoordinator(owner, I.companyA, {
        medicoId: SUCCESSOR,
        startsOn: day(1),
      });
      const company = { params: Promise.resolve({ id: I.companyA }) };
      const plan = { params: Promise.resolve({ id: v2.id }) };
      const signedForm = (medicoId: string) => {
        const form = new FormData();
        for (const [k, v] of Object.entries(fields(medicoId))) form.set(k, v);
        form.set("file", pdf());
        return form;
      };

      // Sucessor (começa amanhã): recusado nas duas superfícies, nada gravado.
      (requireOfficeStaff as jest.Mock).mockResolvedValue(doctor2);
      const approveAction = await approveExamPlanAction(v2.id, {});
      expect(!approveAction.ok && approveAction.error.code).toBe("FORBIDDEN");
      const criteriaAction = await defineInterpretationCriteriaAction(
        I.companyA,
        CRITERIA,
      );
      expect(!criteriaAction.ok && criteriaAction.error.code).toBe("FORBIDDEN");
      const signedAction = await registerSignedPcmsoAction(
        I.companyA,
        signedForm(SUCCESSOR),
      );
      expect(signedAction.ok).toBe(false);
      expect((await APPROVE(jsonReq(doctor2, {}), plan)).status).toBe(403);
      expect((await DEFINE(jsonReq(doctor2, CRITERIA), company)).status).toBe(403);
      const rest2 = await REGISTER(formReq(doctor2, signedForm(SUCCESSOR)), company);
      expect([403, 422]).toContain(rest2.status);
      expect(await signedCount()).toBe(0);
      expect(await criteriaCount()).toBe(0);
      expect(await planStatus(v2.id)).toBe("draft");

      // Atual (encerramento hoje, véspera do sucessor): aceita nas duas superfícies.
      expect(
        (await REGISTER(formReq(doctor, signedForm(MEDICO)), company)).status,
      ).toBe(201);
      expect((await DEFINE(jsonReq(doctor, CRITERIA), company)).status).toBe(201);
      (requireOfficeStaff as jest.Mock).mockResolvedValue(doctor);
      const approved = await approveExamPlanAction(v2.id, { note: "Via Server Action." });
      expect(approved.ok && approved.data).toMatchObject({
        status: "approved",
        approvedByMedicoId: MEDICO,
      });
    });

    it("REST com encerramento agendado para o mês que vem: a coordenadora aprova (200)", async () => {
      await setMedico({ endsOn: day(30) });
      // Antes da correção: 403, a designação deixava de ser "aberta" já hoje.
      const res = await APPROVE(jsonReq(doctor, { note: "Via REST." }), {
        params: Promise.resolve({ id: v2.id }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).approvedByMedicoId).toBe(MEDICO);
    });

    it("vínculo revogado: a coordenadora em vigor não age (core e SQL)", async () => {
      await admin`update medico_user_links set revoked_at=now(), revoked_by='owner', revoke_reason='Revogação fictícia.' where user_id='doctor'`;
      expect(await sqlAll(DOCTOR)).toEqual(DENIED);
      await expectCoreDenied(DOCTOR);
    });

    it("identidade revogada (não verificada): a coordenadora em vigor não age (core e SQL)", async () => {
      await admin`insert into professional_identity_review_events (org_id, kind, verification_id, reason, actor_user_id)
        select org_id, 'revoked', id, 'Revogação fictícia de teste.', 'platform-verifier-test'
        from professional_identity_verifications where user_id = 'doctor'`;
      expect(await sqlAll(DOCTOR)).toEqual(DENIED);
      await expectCoreDenied(DOCTOR);
    });

    it("médico em vigor de OUTRA empresa não age nesta (core e SQL)", async () => {
      const other: Actor = { ctx: doctor3, medicoId: MEDICO_C };
      expect(await sqlAll(other)).toEqual(DENIED);
      await expectCoreDenied(other);
    });

    it("owner sem identidade médica não substitui o coordenador (core e SQL)", async () => {
      const asOwner: Actor = { ctx: owner, medicoId: MEDICO };
      expect(await sqlAll(asOwner)).toEqual(DENIED);
      await expectCoreDenied(asOwner);
    });

    it("outro tenant: NOT_FOUND no core e nada por SQL", async () => {
      await expect(approve(ownerB, v2.id, {})).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(defineCriteria(ownerB, I.companyA, CRITERIA)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        registerSignedPcmso(ownerB, I.companyA, fields(MEDICO), pdf()),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await sqlAll({ ctx: ownerB, medicoId: MEDICO }, "org_b")).toEqual(DENIED);
      expect(await signedCount()).toBe(0);
      expect(await criteriaCount()).toBe(0);
      expect(await planStatus(v2.id)).toBe("draft");
    });
  },
);
