/**
 * Declaração de inexistência de riscos (NOB-156, DT-12, MED-09) contra Postgres efêmero:
 * - só o profissional com autorização ativa de validação de riscos declara (servidor e RLS);
 * - nunca sobre grupo/função com risco pendente ou validado, nem sobre fonte substituída;
 * - vale só para a versão da fonte em que foi feita;
 * - o ASO só deixa de bloquear com declaração vigente; cadastro vazio continua bloqueando;
 * - isolamento entre tenants. Dados fictícios.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { createHealthExam } from "@/shared/db/repositories/health-exams";
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import { getAsoReadiness } from "@/shared/server/medicine/aso-core";
import {
  declareRiskAbsence,
  listRiskAbsence,
} from "@/shared/server/medicine/risk-absence-core";
import {
  GET as LIST,
  POST as DECLARE,
} from "@/app/api/v1/companies/[id]/risk-absence-declarations/route";
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
const prof: TenantContext = { ...owner, userId: "prof", role: "client" };
const outsider: TenantContext = { ...owner, userId: "outsider", role: "client" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const GES_EMPTY = "cccccccc-0000-4000-8000-000000000061";
const JUSTIFICATION =
  "Atividade administrativa fictícia, sem agentes físicos, químicos ou biológicos no posto.";

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

(enabled ? describe : describe.skip)(
  "Declaração de inexistência de riscos (NOB-156)",
  () => {
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
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('prof','p@example.test'),('outsider','x@example.test'),('owner-b','ob@example.test')`;
      await admin`insert into org_memberships (org_id,user_id,role,scoped_company_id) values ('org_a','owner','owner',null),('org_a','staff','collaborator',null),('org_a','prof','client',${I.companyA}),('org_a','outsider','client',${I.companyA}),('org_b','owner-b','owner',null)`;
      await admin`insert into professional_risk_authorizations (org_id, company_id, user_id, active, identity, authorized_by, reason)
      values ('org_a', ${I.companyA}, 'prof', true, ${admin.json({
        fullName: "Profissional Fictícia",
        profession: "Engenheira de segurança",
        registration: { kind: "registered", council: "CREA", number: "0001" },
      })}, 'authorizer', 'Autorização fictícia.')`;
      await admin`insert into ges (id, org_id, company_id, work_unit_id, name) values (${GES_EMPTY}, 'org_a', ${I.companyA}, ${I.workUnitA}, 'GES Administrativo Fictício')`;
      await admin`update risks set noxious_agent_code='02.01.001' where id=${I.riskA}`;
      const source = await registerMedicalRiskSource(owner, I.companyA, {
        kind: "internal",
        pgrId: I.pgrA,
      });
      sourceId = source.id;
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
    });

    const validateRisks = () =>
      admin`update medical_risk_entries set status='validated', reviewed_by='prof', reviewed_at=now() where source_id=${sourceId}`;
    const declaration = (overrides: Record<string, unknown> = {}) => ({
      sourceId,
      gesId: GES_EMPTY,
      justification: JUSTIFICATION,
      ...overrides,
    });
    const asRuntime = <T>(
      actor: string,
      fn: (tx: postgres.TransactionSql) => Promise<T>,
      org = "org_a",
    ) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', ${org}, true)`;
        await tx`select set_config('app.current_actor', ${actor}, true)`;
        return fn(tx);
      }) as Promise<T>;

    it("só o profissional autorizado declara; registro com autor, data e justificativa; só inclusão", async () => {
      await validateRisks();
      for (const ctx of [owner, staff, outsider]) {
        await expect(
          declareRiskAbsence(ctx, I.companyA, declaration()),
        ).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      }
      await expect(
        declareRiskAbsence(ownerB, I.companyA, declaration()),
      ).rejects.toMatchObject({
        code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/),
      });
      const created = await declareRiskAbsence(prof, I.companyA, declaration());
      expect(created.id).toEqual(expect.any(String));
      const listed = await listRiskAbsence(staff, I.companyA);
      expect(listed.canDeclare).toBe(false);
      expect(listed.declarations).toEqual([
        expect.objectContaining({
          sourceId,
          gesId: GES_EMPTY,
          exposureGroup: "GES Administrativo Fictício",
          jobRole: "",
          justification: JUSTIFICATION,
          declaredBy: "prof",
          declaredByName: "Profissional Fictícia",
        }),
      ]);
      expect((await listRiskAbsence(prof, I.companyA)).canDeclare).toBe(true);
      await expect(listRiskAbsence(outsider, I.companyA)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      // Repetir o escopo na mesma fonte → recusado.
      await expect(
        declareRiskAbsence(prof, I.companyA, declaration()),
      ).rejects.toMatchObject({
        code: "VALIDATION",
      });
      // Justificativa curta → recusada.
      await expect(
        declareRiskAbsence(
          prof,
          I.companyA,
          declaration({ jobRole: "Auxiliar", justification: "curta" }),
        ),
      ).rejects.toThrow();
      // Autorização revogada → perde o poder.
      await admin`update professional_risk_authorizations set active=false where user_id='prof'`;
      await expect(
        declareRiskAbsence(prof, I.companyA, declaration({ jobRole: "Auxiliar" })),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("recusa grupo com riscos pendentes ou validados e fonte substituída", async () => {
      // GES do PGR tem riscos pendentes.
      await expect(
        declareRiskAbsence(prof, I.companyA, declaration({ gesId: I.gesA })),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      await validateRisks();
      await expect(
        declareRiskAbsence(prof, I.companyA, declaration({ gesId: I.gesA })),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      // GES de outra empresa / inexistente.
      await expect(
        declareRiskAbsence(prof, I.companyA, declaration({ gesId: I.gesB })),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      // Fonte substituída.
      await admin`insert into medical_risk_sources (org_id, company_id, kind, title, version, reference, fingerprint, supersedes_source_id, registered_by)
      values ('org_a', ${I.companyA}, 'external', 'PGR externo fictício', '2', 'Referência fictícia', 'fx-successor', ${sourceId}, 'owner')`;
      await expect(
        declareRiskAbsence(prof, I.companyA, declaration()),
      ).rejects.toMatchObject({
        code: "VALIDATION",
      });
    });

    it("ASO: cadastro vazio bloqueia; declaração vigente libera; fonte nova exige nova declaração", async () => {
      await validateRisks();
      await admin`update employees set ges_id=${GES_EMPTY} where id=${I.employeeA}`;
      const exam = await createHealthExam("org_a", {
        employeeId: I.employeeA,
        examType: "periodic",
        performedAt: "2026-10-20",
        aptitude: "fit",
      });
      const codes = async () =>
        (await getAsoReadiness(staff, exam.id)).items
          .filter((i) => i.severity === "blocking")
          .map((i) => i.code);
      expect(await codes()).toContain("risks_absence_not_declared");
      await declareRiskAbsence(prof, I.companyA, declaration());
      const after = await codes();
      expect(after).not.toContain("risks_absence_not_declared");
      expect(after).not.toContain("risk_source");
      // Riscos pendentes no grupo do funcionário continuam bloqueando, mesmo com declaração.
      await admin`update employees set ges_id=${I.gesA} where id=${I.employeeA}`;
      await admin`update medical_risk_entries set status='pending', reviewed_by=null, reviewed_at=null where source_id=${sourceId}`;
      expect(await codes()).toContain("risks_pending");
      await validateRisks();
      await admin`update employees set ges_id=${GES_EMPTY} where id=${I.employeeA}`;
      // Nova versão da fonte: a declaração anterior não vale mais.
      await admin`insert into medical_risk_sources (org_id, company_id, kind, title, version, reference, fingerprint, supersedes_source_id, registered_by)
      values ('org_a', ${I.companyA}, 'external', 'PGR externo fictício', '2', 'Referência fictícia', 'fx-successor', ${sourceId}, 'owner')`;
      const superseded = await codes();
      expect(
        superseded.includes("risks_absence_not_declared") ||
          superseded.includes("risk_source"),
      ).toBe(true);
    });

    it("banco: só o profissional autorizado grava, em nome próprio; sem UPDATE/DELETE; isolado por tenant", async () => {
      const insert = (actor: string, declaredBy = actor, jobRole = "") =>
        asRuntime(
          actor,
          (tx) =>
            tx`insert into medical_risk_absence_declarations (org_id, company_id, source_id, ges_id, exposure_group, job_role, justification, declared_by)
            values ('org_a', ${I.companyA}, ${sourceId}, ${GES_EMPTY}, 'GES', ${jobRole}, ${JUSTIFICATION}, ${declaredBy})`,
        );
      for (const actor of ["owner", "staff", "outsider"])
        await expect(insert(actor)).rejects.toMatchObject({ code: "42501" });
      await expect(insert("owner", "prof")).rejects.toMatchObject({ code: "42501" });
      await insert("prof");
      await expect(
        asRuntime(
          "prof",
          (tx) => tx`update medical_risk_absence_declarations set justification='x'`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asRuntime("prof", (tx) => tx`delete from medical_risk_absence_declarations`),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(insert("prof", "prof", "Função curta")).resolves.toBeDefined();
      await expect(
        asRuntime(
          "prof",
          (tx) =>
            tx`insert into medical_risk_absence_declarations (org_id, company_id, source_id, ges_id, exposure_group, justification, declared_by)
            values ('org_a', ${I.companyA}, ${sourceId}, ${GES_EMPTY}, 'GES', 'curta', 'prof')`,
        ),
      ).rejects.toMatchObject({ code: expect.stringMatching(/23514|23505/) });
      const [{ n }] = (await asRuntime(
        "owner-b",
        (tx) => tx`select count(*)::int as n from medical_risk_absence_declarations`,
        "org_b",
      )) as unknown as { n: number }[];
      expect(n).toBe(0);
    });

    it("REST: profissional declara (201); RH lê; cliente sem autorização e outro tenant barrados", async () => {
      const params = { params: Promise.resolve({ id: I.companyA }) };
      const created = await DECLARE(req(prof, "POST", declaration()), params);
      expect(created.status).toBe(201);
      expect(
        (await DECLARE(req(owner, "POST", declaration({ jobRole: "X" })), params)).status,
      ).toBe(403);
      expect(
        (await DECLARE(req(prof, "POST", { ...declaration(), extra: 1 }), params)).status,
      ).toBe(422);
      const listed = await LIST(req(staff), params);
      expect(listed.status).toBe(200);
      expect((await listed.json()).declarations).toHaveLength(1);
      expect((await LIST(req(outsider), params)).status).toBe(403);
      expect((await LIST(req(ownerB), params)).status).not.toBe(200);
    });

    describe("função = função cadastrada e vinculada ao GES (NOB-112)", () => {
      // GES_EMPTY: "Pedreiro" (seed) e "PEDREIRO" (outra função, mesma empresa, só a caixa muda).
      // "Soldador" só no GES A.
      const JR_UPPER = "cccccccc-0000-4000-8000-000000000071";
      const JR_OTHER_GES = "cccccccc-0000-4000-8000-000000000072";
      const typoFieldError = {
        issues: [
          expect.objectContaining({
            path: ["jobRole"],
            message: expect.stringMatching(/não encontrada entre as funções/),
          }),
        ],
      };
      const count = async () => {
        const rows =
          (await admin`select count(*)::int as n from medical_risk_absence_declarations`) as unknown as {
            n: number;
          }[];
        return rows[0].n;
      };
      let examId: string;
      const blockingCodes = async () =>
        (await getAsoReadiness(staff, examId)).items
          .filter((i) => i.severity === "blocking")
          .map((i) => i.code);

      beforeEach(async () => {
        await admin`insert into job_roles (id, org_id, company_id, title) values
          (${JR_UPPER}, 'org_a', ${I.companyA}, 'PEDREIRO'),
          (${JR_OTHER_GES}, 'org_a', ${I.companyA}, 'Soldador')`;
        await admin`insert into ges_job_roles (org_id, ges_id, job_role_id, worker_count) values
          ('org_a', ${GES_EMPTY}, ${I.jobRoleA}, 2),
          ('org_a', ${GES_EMPTY}, ${JR_UPPER}, 1),
          ('org_a', ${I.gesA}, ${JR_OTHER_GES}, 1)`;
        await validateRisks();
        await admin`update employees set ges_id=${GES_EMPTY} where id=${I.employeeA}`;
        const exam = await createHealthExam("org_a", {
          employeeId: I.employeeA,
          examType: "periodic",
          performedAt: "2026-10-20",
          aptitude: "fit",
        });
        examId = exam.id;
      });

      it("lista as funções vinculadas a cada GES para quem pode declarar", async () => {
        const { groups } = await listRiskAbsence(prof, I.companyA);
        const byId = new Map(groups.map((g) => [g.id, g]));
        expect(
          byId
            .get(GES_EMPTY)
            ?.jobRoles.map((r) => r.title)
            .sort(),
        ).toEqual(["PEDREIRO", "Pedreiro"].sort());
        expect(
          byId
            .get(I.gesA)
            ?.jobRoles.map((r) => r.title)
            .sort(),
        ).toEqual(["Pedreiro", "Soldador"].sort());
        // Função de outro tenant nunca aparece.
        expect(groups.flatMap((g) => g.jobRoles.map((r) => r.title))).not.toContain(
          "Eletricista",
        );
      });

      it("erro de digitação ou abreviação → VALIDATION no campo jobRole e nada gravado", async () => {
        for (const typo of ["Pedreir", "Op. pedreiro", "pedreiro"])
          await expect(
            declareRiskAbsence(prof, I.companyA, declaration({ jobRole: typo })),
          ).rejects.toMatchObject(typoFieldError);
        expect(await count()).toBe(0);
        // REST: 422 com a mensagem no campo.
        const params = { params: Promise.resolve({ id: I.companyA }) };
        const res = await DECLARE(
          req(prof, "POST", declaration({ jobRole: "Pedreir" })),
          params,
        );
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION");
        expect(body.error.fields.jobRole).toMatch(/não encontrada entre as funções/);
        expect(await count()).toBe(0);
        expect(await blockingCodes()).toContain("risks_absence_not_declared");
      });

      it("função de outro GES da empresa → VALIDATION no campo, nada gravado", async () => {
        await expect(
          declareRiskAbsence(prof, I.companyA, declaration({ jobRole: "Soldador" })),
        ).rejects.toMatchObject(typoFieldError);
        expect(await count()).toBe(0);
      });

      it("função exata aceita e libera o item c do ASO do funcionário com aquela função", async () => {
        expect(await blockingCodes()).toContain("risks_absence_not_declared");
        await declareRiskAbsence(prof, I.companyA, declaration({ jobRole: "Pedreiro" }));
        const after = await blockingCodes();
        expect(after).not.toContain("risks_absence_not_declared");
        expect(after).not.toContain("risk_source");
        const { declarations } = await listRiskAbsence(staff, I.companyA);
        expect(declarations).toEqual([
          expect.objectContaining({ gesId: GES_EMPTY, jobRole: "Pedreiro" }),
        ]);
      });

      it('variação de caixa é outra função: declaração de "Pedreiro" não vale para "PEDREIRO"', async () => {
        await declareRiskAbsence(prof, I.companyA, declaration({ jobRole: "Pedreiro" }));
        await admin`update employees set job_role_id=${JR_UPPER} where id=${I.employeeA}`;
        expect(await blockingCodes()).toContain("risks_absence_not_declared");
        // A própria "PEDREIRO", vinculada ao GES, pode ser declarada e então vale.
        await declareRiskAbsence(prof, I.companyA, declaration({ jobRole: "PEDREIRO" }));
        expect(await blockingCodes()).not.toContain("risks_absence_not_declared");
      });

      it("declaração antiga com texto que não é exatamente a função continua bloqueando (fail closed) e é explicada", async () => {
        // Gravada como antes da conferência (texto livre), direto pelo profissional autorizado.
        for (const legacy of ["pedreiro", "Pedreir"])
          await asRuntime(
            "prof",
            (tx) =>
              tx`insert into medical_risk_absence_declarations (org_id, company_id, source_id, ges_id, exposure_group, job_role, justification, declared_by)
              values ('org_a', ${I.companyA}, ${sourceId}, ${GES_EMPTY}, 'GES Administrativo Fictício', ${legacy}, ${JUSTIFICATION}, 'prof')`,
          );
        const readiness = await getAsoReadiness(staff, examId);
        const item = readiness.items.find((i) => i.code === "risks_absence_not_declared");
        expect(item?.severity).toBe("blocking");
        expect(item?.message).toContain('"pedreiro"');
        expect(item?.message).toContain('"Pedreir"');
        expect(item?.message).toContain('("Pedreiro")');
        // Nada é apagado nem reassociado.
        expect(await count()).toBe(2);
      });

      it("autorização e tenant intactos: sem autorização → 403 antes de conferir a função; outro tenant barrado", async () => {
        for (const ctx of [owner, staff, outsider])
          for (const jobRole of ["Pedreiro", "Pedreir"])
            await expect(
              declareRiskAbsence(ctx, I.companyA, declaration({ jobRole })),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          declareRiskAbsence(ownerB, I.companyA, declaration({ jobRole: "Pedreiro" })),
        ).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/) });
        // Função de outro tenant, no GES deste tenant → recusada no campo.
        await expect(
          declareRiskAbsence(prof, I.companyA, declaration({ jobRole: "Eletricista" })),
        ).rejects.toMatchObject(typoFieldError);
        expect(await count()).toBe(0);
      });
    });
  },
);
