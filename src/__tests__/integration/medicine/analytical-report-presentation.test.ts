/**
 * Apresentação e discussão do relatório analítico do PCMSO (NOB-168; NR-7 7.6.5) contra Postgres
 * efêmero. Só versão finalizada pelo médico responsável é apresentada; apresentação e discussão são
 * atos registrados (nada automático); CIPA nunca presumida; nova versão não herda a apresentação;
 * correções preservam o histórico; SQL direto e perfis indevidos barrados. Dados fictícios.
 */
import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import { todayInSaoPaulo } from "@/shared/dates";
import { generateReport } from "@/shared/server/medicine/analytical-report-core";
import {
  listReportPresentation,
  registerReportEvent,
  voidReportEvent,
} from "@/shared/server/medicine/analytical-report-presentation-core";
import { GET as LIST } from "@/app/api/v1/companies/[id]/analytical-report-events/route";
import { POST as EVENTS } from "@/app/api/v1/analytical-reports/[id]/events/route";
import { POST as VOID } from "@/app/api/v1/analytical-report-events/[id]/void/route";
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
const ownerB: TenantContext = {
  tenantId: "org_b",
  userId: "owner-b",
  role: "owner",
  plan: "pro",
};
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000091";
const COMPANY_C = "cccccccc-0000-4000-8000-000000000092";
const FIRST = { periodStart: "2025-11-01", periodEnd: "2026-10-31" };

const req = (ctx: TenantContext, body?: unknown) =>
  new NextRequest("http://localhost/api", {
    method: body === undefined ? "GET" : "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)(
  "Apresentação do relatório analítico (NOB-168)",
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

    let today: string;
    beforeEach(async () => {
      today = todayInSaoPaulo();
      await seedPgrBase(admin);
      await admin`insert into users (id,email) values ('owner','o@example.test'),('staff','s@example.test'),('doctor','d@example.test'),('client','c@example.test'),('owner-b','ob@example.test')`;
      await admin`insert into org_memberships (org_id,user_id,role) values ('org_a','owner','owner'),('org_a','staff','org:member'),('org_a','doctor','collaborator'),('org_a','client','org:client'),('org_b','owner-b','owner')`;
      await admin`update companies set risk_grade=3 where id=${I.companyA}`;
      await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status)
      values (${MEDICO}, 'org_a', 'Dra. Coordenadora Fictícia', '63001', 'physician', 'MA', '964', 'internal', 'active')`;
      await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO}, '2025-01-01', 'owner')`;
      await admin`insert into companies (id, org_id, cnpj, razao_social) values (${COMPANY_C}, 'org_a', '33444555000166', 'C Fictícia Ltda')`;
      await admin`insert into company_modules (org_id, company_id, module, enabled) values ('org_a', ${COMPANY_C}, 'medicine', true)`;
      await link(owner, MEDICO, { userId: "doctor", reason: "Coordenadora fictícia." });
      process.env.APP_ENV = "local";
      process.env.DEV_API_AUTH_BYPASS = "true";
    });

    const presentation = (o: Record<string, unknown> = {}) => ({
      kind: "presented",
      occurredOn: today,
      modality: "in_person",
      participants: [
        { role: "cipa", name: "Representante fictício" },
        { role: "sst_responsible" },
      ],
      cipaSituation: "participated",
      evidenceReference: "Ata fictícia nº 12",
      ...o,
    });
    const discussion = (o: Record<string, unknown> = {}) => ({
      kind: "discussed",
      occurredOn: today,
      participants: [{ role: "cipa" }, { role: "pcmso_coordinator" }],
      summary: "Discussão agregada dos indicadores do período (fictícia).",
      measures: [
        {
          description: "Reforçar treinamento de proteção auditiva",
          responsible: "SESMT",
        },
        {
          description: "Revisar o cronograma de exames periódicos",
          dueDate: "2027-02-28",
        },
      ],
      evidenceReference: "Ata fictícia nº 12, item 3",
      ...o,
    });
    const state = async () => (await listReportPresentation(staff, I.companyA)).summary;

    it("prévia não finalizada é recusada; o médico autor finaliza; apresentação sem discussão; discussão registrada", async () => {
      const report = await generateReport(doctor, I.companyA, FIRST);
      expect((await state()).state).toBe("not_finalized");
      await expect(
        registerReportEvent(staff, report.id, presentation()),
      ).rejects.toMatchObject({
        code: "VALIDATION",
        message: expect.stringMatching(/finalizada/),
      });
      // Owner e colaborador não finalizam; o médico autor sim.
      for (const ctx of [owner, staff])
        await expect(
          registerReportEvent(ctx, report.id, { kind: "finalized" }),
        ).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      const fin = await registerReportEvent(doctor, report.id, {
        kind: "finalized",
        note: "Versão final.",
      });
      expect(fin).toMatchObject({
        kind: "finalized",
        reportSha256: report.contentSha256,
        recordedBy: "doctor",
      });
      await expect(
        registerReportEvent(doctor, report.id, { kind: "finalized" }),
      ).rejects.toMatchObject({
        code: "VALIDATION",
      });
      expect((await state()).state).toBe("pending_presentation");
      // Discussão antes da apresentação: recusada.
      await expect(
        registerReportEvent(staff, report.id, discussion()),
      ).rejects.toMatchObject({
        code: "VALIDATION",
      });
      const pres = await registerReportEvent(staff, report.id, presentation());
      expect(pres).toMatchObject({
        kind: "presented",
        cipaSituation: "participated",
        recordedBy: "staff",
      });
      expect(await state()).toMatchObject({
        state: "discussion_pending",
        cipaRequirementMet: true,
      });
      const disc = await registerReportEvent(staff, report.id, discussion());
      expect(disc.measures).toHaveLength(2);
      expect(JSON.stringify(disc.measures)).not.toMatch(/execut|conclu/i);
      expect((await state()).state).toBe("presented_and_discussed");
    });

    it("CIPA: sem CIPA verificada atende; desconhecida e existente-sem-participar não atendem; SESMT não é obrigatório", async () => {
      const report = await generateReport(doctor, I.companyA, FIRST);
      await registerReportEvent(doctor, report.id, { kind: "finalized" });
      // Sem CIPA exige a referência da verificação; CIPA participou exige o representante.
      await expect(
        registerReportEvent(
          staff,
          report.id,
          presentation({ cipaSituation: "not_constituted", cipaReference: "" }),
        ),
      ).rejects.toThrow();
      await expect(
        registerReportEvent(
          staff,
          report.id,
          presentation({ participants: [{ role: "sst_responsible" }] }),
        ),
      ).rejects.toThrow();
      const unknown = await registerReportEvent(
        staff,
        report.id,
        presentation({
          cipaSituation: "unknown",
          participants: [{ role: "sst_responsible" }],
        }),
      );
      expect(await state()).toMatchObject({
        cipaSituation: "unknown",
        cipaRequirementMet: false,
      });
      await voidReportEvent(staff, unknown.id, {
        reason: "Situação da CIPA verificada depois.",
      });
      await registerReportEvent(
        staff,
        report.id,
        presentation({
          cipaSituation: "exists_not_participated",
          participants: [{ role: "employer" }],
        }),
      );
      expect(await state()).toMatchObject({ cipaRequirementMet: false });
      // Sem CIPA (verificado) e sem SESMT: atende.
      await registerReportEvent(
        staff,
        report.id,
        presentation({
          cipaSituation: "not_constituted",
          cipaReference: "Conferido no cadastro de CIPA da empresa (fictício)",
          participants: [{ role: "sst_responsible" }, { role: "employer" }],
        }),
      );
      expect(await state()).toMatchObject({
        cipaSituation: "not_constituted",
        cipaRequirementMet: true,
      });
    });

    it("nova versão não herda a apresentação; versão antiga não recebe registros; histórico preservado", async () => {
      const v1 = await generateReport(doctor, I.companyA, FIRST);
      await registerReportEvent(doctor, v1.id, { kind: "finalized" });
      await registerReportEvent(staff, v1.id, presentation());
      const v2 = await generateReport(doctor, I.companyA, {
        periodStart: "2026-11-01",
        periodEnd: "2026-11-02",
        variationDiscussion: "Discussão fictícia da coordenadora sobre as variações.",
      });
      const listed = await listReportPresentation(staff, I.companyA);
      expect(listed.current?.id).toBe(v2.id);
      expect(listed.summary).toMatchObject({
        state: "not_finalized",
        previousVersionPresented: true,
      });
      await expect(registerReportEvent(staff, v1.id, discussion())).rejects.toMatchObject(
        {
          code: "VALIDATION",
          message: expect.stringMatching(/versão mais recente/),
        },
      );
      expect(listed.events.filter((e) => e.reportId === v1.id)).toHaveLength(2);
    });

    it("correção com histórico: apresentação corrigida perde efeito; finalização só o médico corrige", async () => {
      const report = await generateReport(doctor, I.companyA, FIRST);
      const fin = await registerReportEvent(doctor, report.id, { kind: "finalized" });
      const pres = await registerReportEvent(staff, report.id, presentation());
      const corr = await voidReportEvent(staff, pres.id, {
        reason: "Data da reunião registrada errada.",
      });
      expect(corr).toMatchObject({ kind: "voided", voidsId: pres.id });
      expect((await state()).state).toBe("pending_presentation");
      await expect(
        voidReportEvent(staff, pres.id, { reason: "Segunda correção indevida." }),
      ).rejects.toMatchObject({
        code: "VALIDATION",
      });
      await expect(
        voidReportEvent(staff, corr.id, { reason: "Correção de correção fictícia." }),
      ).rejects.toMatchObject({
        code: "VALIDATION",
      });
      await expect(
        voidReportEvent(staff, fin.id, { reason: "Tentativa da equipe de desfazer." }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await voidReportEvent(doctor, fin.id, {
        reason: "Versão reaberta para revisão médica.",
      });
      expect((await state()).state).toBe("not_finalized");
      expect((await listReportPresentation(staff, I.companyA)).events).toHaveLength(4);
    });

    it("datas e campos: ato futuro, data anterior à versão, sem participantes e síntese curta são recusados", async () => {
      const report = await generateReport(doctor, I.companyA, FIRST);
      await registerReportEvent(doctor, report.id, { kind: "finalized" });
      const bads: Record<string, unknown>[] = [
        presentation({ occurredOn: "2099-01-01" }),
        presentation({ occurredOn: "2020-01-01" }),
        presentation({ participants: [] }),
        presentation({ modality: "agendada" }),
        presentation({ participants: [{ role: "cipa", cpf: "00000000000" }] }),
      ];
      for (const bad of bads)
        await expect(registerReportEvent(staff, report.id, bad)).rejects.toThrow();
      await registerReportEvent(staff, report.id, presentation());
      await expect(
        registerReportEvent(staff, report.id, discussion({ summary: "curta" })),
      ).rejects.toThrow();
      expect((await state()).state).toBe("discussion_pending");
    });

    it("SQL direto: autoria, empresa, versão (hash), relatório inexistente, finalização forjada, apresentação sem finalização, UPDATE/DELETE", async () => {
      const report = await generateReport(doctor, I.companyA, FIRST);
      const as = (actor: string, fn: (tx: postgres.TransactionSql) => Promise<unknown>) =>
        runtime.begin(async (tx) => {
          await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${actor}, true)`;
          return fn(tx);
        });
      const forge = (
        actor: string,
        o: {
          kind?: string;
          recordedBy?: string;
          companyId?: string;
          sha?: string;
          reportId?: string;
        } = {},
      ) =>
        as(actor, (tx) =>
          (o.kind ?? "presented") === "finalized"
            ? tx`insert into pcmso_analytical_report_events (org_id, company_id, report_id, report_sha256, kind, recorded_by)
              values ('org_a', ${o.companyId ?? I.companyA}, ${o.reportId ?? report.id}, ${o.sha ?? report.contentSha256}, 'finalized', ${o.recordedBy ?? actor})`
            : tx`insert into pcmso_analytical_report_events (org_id, company_id, report_id, report_sha256, kind, occurred_on, modality, participants, cipa_situation, recorded_by)
              values ('org_a', ${o.companyId ?? I.companyA}, ${o.reportId ?? report.id}, ${o.sha ?? report.contentSha256}, 'presented', ${today},
                'in_person', ${JSON.stringify([{ role: "sst_responsible" }])}::jsonb, 'unknown', ${o.recordedBy ?? actor})`,
        );
      // Finalização forjada por owner ou equipe; apresentação sem finalização (trigger).
      await expect(forge("owner", { kind: "finalized" })).rejects.toMatchObject({
        code: "42501",
      });
      await expect(forge("staff", { kind: "finalized" })).rejects.toMatchObject({
        code: "42501",
      });
      await expect(forge("staff")).rejects.toMatchObject({ code: "42501" });
      await registerReportEvent(doctor, report.id, { kind: "finalized" });
      await expect(forge("staff", { recordedBy: "owner" })).rejects.toMatchObject({
        code: "42501",
      });
      await expect(forge("client")).rejects.toMatchObject({ code: "42501" });
      await expect(forge("intruso")).rejects.toMatchObject({ code: "42501" });
      await expect(forge("staff", { sha: "f".repeat(64) })).rejects.toMatchObject({
        code: "42501",
      });
      await expect(forge("staff", { companyId: COMPANY_C })).rejects.toMatchObject({
        code: expect.stringMatching(/42501|23503/),
      });
      await expect(
        forge("staff", { reportId: "bbbbbbbb-0000-4000-8000-000000000003" }),
      ).rejects.toMatchObject({
        code: expect.stringMatching(/42501|23503/),
      });
      const pres = await registerReportEvent(staff, report.id, presentation());
      await expect(
        as(
          "staff",
          (tx) =>
            tx`update pcmso_analytical_report_events set cipa_situation = 'participated' where id = ${pres.id}`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        as(
          "owner",
          (tx) => tx`delete from pcmso_analytical_report_events where id = ${pres.id}`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });

    it("REST, perfis e tenant: cliente 403, outro tenant 404; sigilo: nenhum dado clínico individual", async () => {
      const report = await generateReport(doctor, I.companyA, FIRST);
      const params = { params: Promise.resolve({ id: report.id }) };
      expect((await EVENTS(req(doctor, { kind: "finalized" }), params)).status).toBe(201);
      const created = await EVENTS(req(staff, presentation()), params);
      expect(created.status).toBe(201);
      const { id } = await created.json();
      expect(
        (
          await EVENTS(
            req({ ...owner, userId: "client", role: "client" }, discussion()),
            params,
          )
        ).status,
      ).toBe(403);
      expect((await EVENTS(req(ownerB, discussion()), params)).status).toBe(404);
      const list = await LIST(req(staff), {
        params: Promise.resolve({ id: I.companyA }),
      });
      expect(list.status).toBe(200);
      const body = await list.json();
      expect(body.summary.state).toBe("discussion_pending");
      expect(JSON.stringify(body)).not.toMatch(/cpf|cid|diagn/i);
      expect(
        (await LIST(req(ownerB), { params: Promise.resolve({ id: I.companyA }) })).status,
      ).toBe(404);
      expect(
        (
          await VOID(req(staff, { reason: "Ata errada anexada por engano." }), {
            params: Promise.resolve({ id }),
          })
        ).status,
      ).toBe(201);
      await expect(listReportPresentation(ownerB, I.companyA)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  },
);
