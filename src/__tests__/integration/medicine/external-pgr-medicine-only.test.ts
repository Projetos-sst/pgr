/**
 * NOB-111 — PGR externo numa empresa só com Medicina (serviço PGR desabilitado), contra Postgres
 * efêmero com RLS: proveniência do documento, riscos estruturados (com o código do agente nocivo
 * informado na origem), validação técnica real pela cadeia de autorização da empresa, consumo no
 * plano e na prévia do PCMSO com a origem explícita, versões, rejeição, isolamento e o módulo PGR
 * continuando fechado. Dados fictícios.
 */
import type postgres from "postgres";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  getMedicalRiskInventory,
  registerMedicalRiskSource,
} from "@/shared/server/medicine/risk-source-core";
import {
  appointCompanyAuthorizer,
  authorizeCompanyProfessional,
  decideCompanyRisk,
} from "@/shared/server/medicine/risk-authorization-core";
import { getExamProposal } from "@/shared/server/medicine/exam-proposal-core";
import {
  approve,
  createDraft,
  decideItem,
  getPlan,
} from "@/shared/server/medicine/exam-plan-core";
import { generateDocument } from "@/shared/server/medicine/pcmso-document-core";
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
const authority: TenantContext = { ...owner, userId: "authorizer", role: "client" };
const professional: TenantContext = { ...owner, userId: "professional", role: "client" };
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000111";

const externalSource = (o: Record<string, unknown> = {}) => ({
  kind: "external",
  title: "PGR elaborado por consultoria terceira (fictício)",
  version: "Rev. 3",
  reference:
    "PGR Consultoria Fictícia, rev. 3 — arquivado no GED da empresa, pasta SST/2026",
  documentDate: "2026-08-01",
  preparedBy: "Eng. de Segurança Fictício (CREA 000)",
  reviewDueOn: "2028-08-01",
  risks: [
    {
      agentType: "physical",
      description: "Ruído contínuo acima do nível de ação (conforme o PGR externo)",
      exposureGroup: "Produção",
      jobRole: "Operador de máquina",
      possibleInjuries: "Perda auditiva induzida por ruído",
      noxiousAgentCode: "02.01.001",
    },
  ],
  ...o,
});

(enabled ? describe : describe.skip)(
  "PGR externo — empresa só com Medicina (NOB-111)",
  () => {
    let admin: ReturnType<typeof postgres>;
    let runtime: ReturnType<typeof postgres>;
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
      await runtime?.end({ timeout: 5 });
      await admin?.end({ timeout: 5 });
    });

    beforeEach(async () => {
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('authorizer','a@example.test'),('professional','p@example.test'),('owner-b','ob@example.test')`;
      await admin`insert into org_memberships (org_id,user_id,role,scoped_company_id) values ('org_a','owner','owner',null),('org_a','staff','org:member',null),('org_a','doctor','collaborator',null),('org_a','authorizer','client',${I.companyA}),('org_a','professional','client',${I.companyA}),('org_b','owner-b','owner',null)`;
      await admin`update companies set cnae='4120-4', main_activity='Construção de edifícios', risk_grade=3 where id=${I.companyA}`;
      // Cenário obrigatório: Medicina habilitada, PGR desabilitado.
      await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='pgr'`;
      await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status)
      values (${MEDICO}, 'org_a', 'Dra. Coordenadora Fictícia', '11101', 'physician', 'MA', '911', 'internal', 'active')`;
      await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO}, '2026-01-01', 'owner')`;
      await link(owner, MEDICO, { userId: "doctor", reason: "Coordenadora fictícia." });
    });

    async function authorizeProfessional() {
      await appointCompanyAuthorizer(owner, I.companyA, {
        userId: "authorizer",
        evidence: "Documento de indicação da empresa (fictício)",
        reason: "Indicação da empresa-cliente",
      });
      await authorizeCompanyProfessional(authority, I.companyA, {
        userId: "professional",
        active: true,
        identity: {
          fullName: "Profissional de SST Fictício",
          profession: "Engenheiro de segurança do trabalho",
          registration: { kind: "registered", council: "CREA", number: "000" },
        },
        reason: "Autorização específica da empresa para validar o PGR externo",
      });
    }
    const sourceOf = async (sourceId: string) =>
      (await getMedicalRiskInventory(staff, I.companyA)).rows.find(
        (s) => s.id === sourceId,
      )!;
    const decide = (
      entryId: string,
      status: "validated" | "rejected",
      ctx = professional,
    ) =>
      decideCompanyRisk(ctx, I.companyA, entryId, {
        status,
        reason: "Parecer técnico fictício sobre o PGR externo",
        expectedStatus: "pending",
        expectedReviewedAt: null,
      });

    it("cadastro → pendente bloqueia o PCMSO → só o profissional autorizado valida → sugestão pela regra → plano aprovado pelo médico → prévia com 'PGR externo validado'", async () => {
      const source = await registerMedicalRiskSource(staff, I.companyA, externalSource());
      let current = await sourceOf(source.id);
      expect(current).toMatchObject({
        kind: "external",
        status: "awaiting_validation",
        documentDate: "2026-08-01",
        preparedBy: "Eng. de Segurança Fictício (CREA 000)",
        reviewDueOn: "2028-08-01",
        registeredBy: "staff",
      });
      expect(current.risks[0]).toMatchObject({
        status: "pending",
        usableForPcmso: false,
      });
      expect(current.risks[0].content.noxiousAgentCode).toBe("02.01.001");

      // Pendente: não entra no plano nem na prévia.
      const pendingProposal = await getExamProposal(staff, I.companyA);
      expect(pendingProposal.excluded.pending).toHaveLength(1);
      expect(pendingProposal.groups).toHaveLength(0);
      await expect(
        generateDocument(staff, I.companyA, { cycleStart: "2026-11-01" }),
      ).rejects.toMatchObject({ code: "VALIDATION" });

      // Owner e médico coordenador não validam riscos por causa do papel.
      await authorizeProfessional();
      const entryId = current.risks[0].id;
      await expect(decide(entryId, "validated", owner)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(decide(entryId, "validated", doctor)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      const reviewed = await decide(entryId, "validated");
      expect(reviewed.reviewerId).toBe("professional");
      current = await sourceOf(source.id);
      expect(current.status).toBe("validated");
      expect(current.risks[0].usableForPcmso).toBe(true);

      // O código informado no PGR externo aciona a regra (ruído → audiometria) — antes, nenhum exame.
      const proposal = await getExamProposal(staff, I.companyA);
      const group = proposal.groups.find((g) => g.exposureGroup === "Produção")!;
      expect(group.suggestions.length).toBeGreaterThan(0);
      expect(group.withoutRule).toHaveLength(0);

      // Plano não é aprovado automaticamente: rascunho até a decisão do médico.
      const draft = await createDraft(staff, I.companyA);
      const plan = await getPlan(staff, draft.id);
      expect(plan.status).toBe("draft");
      expect(plan.items.length).toBeGreaterThan(0);
      for (const item of plan.items)
        await decideItem(doctor, draft.id, item.id, {
          decision: "kept",
          periodicity: "Anual",
        });
      await approve(doctor, draft.id, {
        note: "Aprovação fictícia com base no PGR externo.",
      });

      await generateDocument(staff, I.companyA, { cycleStart: "2026-11-01" });
      const [doc] =
        await admin`select content->'riskBasis' as basis from pcmso_documents order by generated_at desc limit 1`;
      expect(doc.basis).toMatchObject({
        origin: "PGR externo validado",
        sources: [
          {
            id: source.id,
            kind: "external",
            origin: "PGR externo validado",
            version: "Rev. 3",
            reference: expect.stringContaining("GED"),
            documentDate: "2026-08-01",
            preparedBy: "Eng. de Segurança Fictício (CREA 000)",
            validatedRisks: 1,
            lastValidatedOn: todayInSaoPaulo(),
          },
        ],
      });

      // Módulo PGR continua fechado: nem leitura nem escrita de PGR interno por SQL direto.
      await runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', 'staff', true)`;
        expect(
          await tx`select id from pgr where company_id = ${I.companyA}`,
        ).toHaveLength(0);
      });
      await expect(
        runtime.begin(async (tx) => {
          await tx`select set_config('app.current_org', 'org_a', true)`;
          await tx`insert into pgr (org_id, company_id, registration_type, issued_at, valid_until) values ('org_a', ${I.companyA}, 'not_applicable', '2026-01-10', '2027-01-10')`;
        }),
      ).rejects.toMatchObject({ code: "42501" });
    });

    it("nova versão substitui a anterior (que deixa de valer), exige nova validação e não altera a prévia arquivada", async () => {
      await authorizeProfessional();
      const v1 = await registerMedicalRiskSource(staff, I.companyA, externalSource());
      await decide((await sourceOf(v1.id)).risks[0].id, "validated");
      const draft = await createDraft(staff, I.companyA);
      for (const item of (await getPlan(staff, draft.id)).items)
        await decideItem(doctor, draft.id, item.id, {
          decision: "kept",
          periodicity: "Anual",
        });
      await approve(doctor, draft.id, { note: "Aprovação fictícia." });
      await generateDocument(staff, I.companyA, { cycleStart: "2026-11-01" });
      const [before] =
        await admin`select id, content_sha256, content from pcmso_documents`;

      const v2 = await registerMedicalRiskSource(
        staff,
        I.companyA,
        externalSource({
          version: "Rev. 4",
          documentDate: "2026-10-01",
          supersedesSourceId: v1.id,
        }),
      );
      expect((await sourceOf(v1.id)).status).toBe("superseded");
      expect((await sourceOf(v1.id)).risks[0].usableForPcmso).toBe(false);
      expect((await sourceOf(v2.id)).status).toBe("awaiting_validation");
      // Nova emissão exige revalidar: a base vigente não tem risco validado.
      await expect(
        generateDocument(staff, I.companyA, { cycleStart: "2026-11-01" }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const [after] =
        await admin`select id, content_sha256, content from pcmso_documents where id = ${before.id}`;
      expect(after).toEqual(before);
    });

    it("rejeição: fonte rejeitada, risco fora do plano; ausência de riscos não é ausência comprovada", async () => {
      await authorizeProfessional();
      const source = await registerMedicalRiskSource(staff, I.companyA, externalSource());
      await decide((await sourceOf(source.id)).risks[0].id, "rejected");
      expect((await sourceOf(source.id)).status).toBe("rejected");
      const proposal = await getExamProposal(staff, I.companyA);
      expect(proposal.excluded.rejected).toHaveLength(1);
      expect(proposal.groups).toHaveLength(0);

      const empty = await registerMedicalRiskSource(
        staff,
        I.companyA,
        externalSource({ version: "Rev. 5", risks: [], supersedesSourceId: source.id }),
      );
      const listed = await sourceOf(empty.id);
      expect(listed.status).toBe("registered_without_risks");
      expect(listed.warnings.join(" ")).toMatch(/não comprova ausência de riscos/);
    });

    it("entrada inválida, data de revisão vencida, outro tenant e empresa sem Medicina", async () => {
      for (const bad of [
        externalSource({ reference: "PGR" }),
        externalSource({ documentDate: "2999-01-01" }),
        externalSource({ documentDate: "2026-08-01", reviewDueOn: "2026-01-01" }),
        externalSource({
          risks: [
            {
              agentType: "physical",
              description: "Ruído",
              exposureGroup: "Produção",
              noxiousAgentCode: "ruído",
            },
          ],
        }),
        externalSource({
          risks: [
            {
              agentType: "physical",
              description: "Ruído",
              exposureGroup: "Produção",
              status: "validated",
            },
          ],
        }),
      ])
        await expect(registerMedicalRiskSource(staff, I.companyA, bad)).rejects.toThrow();

      const overdue = await registerMedicalRiskSource(
        staff,
        I.companyA,
        externalSource({ documentDate: "2023-01-01", reviewDueOn: "2025-01-01" }),
      );
      expect((await sourceOf(overdue.id)).warnings.join(" ")).toMatch(
        /data de revisão informada/,
      );

      await expect(getMedicalRiskInventory(ownerB, I.companyA)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
      await expect(
        registerMedicalRiskSource(
          staff,
          I.companyA,
          externalSource({ version: "Rev. 9" }),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("SQL direto: proveniência só em fonte externa; risco não entra validado nem é validado sem autorização", async () => {
      const source = await registerMedicalRiskSource(staff, I.companyA, externalSource());
      const entryId = (await sourceOf(source.id)).risks[0].id;
      const as = (actor: string, fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
        runtime.begin(async (tx) => {
          await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
          return fn(tx);
        });
      await expect(
        as(
          "staff",
          (
            tx,
          ) => tx`insert into medical_risk_sources (org_id, company_id, kind, title, version, reference, origin_pgr_id, fingerprint, registered_by, document_date)
        values ('org_a', ${I.companyA}, 'internal', 'PGR', '1', 'PGR:x', ${I.pgrA}, 'fp-x', 'staff', '2026-01-01')`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
      expect(
        await as(
          "staff",
          (tx) =>
            tx`update medical_risk_entries set status='validated', reviewed_by='staff', reviewed_at=now() where id=${entryId} returning id`,
        ),
      ).toHaveLength(0);
      await expect(
        as(
          "staff",
          (
            tx,
          ) => tx`insert into medical_risk_entries (org_id, company_id, source_id, content, status, reviewed_by, reviewed_at)
        values ('org_a', ${I.companyA}, ${source.id}, ${tx.json({ agentType: "physical", description: "x", exposureGroup: "y" })}, 'validated', 'staff', now())`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
  },
);
