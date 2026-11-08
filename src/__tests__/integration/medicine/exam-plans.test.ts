/**
 * Plano de exames (NOB-150) contra Postgres efêmero: a equipe prepara o rascunho a partir dos
 * riscos validados; só a coordenadora vinculada (NOB-149) decide e aprova — no app e na RLS;
 * aprovado não muda; nova versão substitui a anterior; trilha de eventos; isolamento e módulo.
 * Validação do risco e designação entram por fixture (fluxos de origem já testados). Fictício.
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
import { registerMedicalRiskSource } from "@/shared/server/medicine/risk-source-core";
import { linkByInvitation as link } from "../_helpers/professional-link";
import {
  addItem,
  approve,
  createDraft,
  decideItem,
  getPlan,
  listPlans,
} from "@/shared/server/medicine/exam-plan-core";
import {
  approveExamPlanAction,
  createExamPlanDraftAction,
  decideExamPlanItemAction,
  addExamPlanItemAction,
} from "@/shared/server/actions/medicine/exam-plans";
import { GET as LIST, POST as DRAFT } from "@/app/api/v1/companies/[id]/exam-plans/route";
import { GET as SHOW } from "@/app/api/v1/exam-plans/[id]/route";
import { POST as APPROVE } from "@/app/api/v1/exam-plans/[id]/approval/route";
import { PUT as DECIDE } from "@/app/api/v1/exam-plans/[id]/items/[itemId]/route";
import { POST as ADD } from "@/app/api/v1/exam-plans/[id]/items/route";
import { EXAM_PLAN_ITEM_DUPLICATE_MESSAGE } from "@/shared/domains/medicine/exam-plan";
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
const MEDICO = "aaaaaaaa-0000-4000-8000-000000000021";
const WHY = "Justificativa clínica fictícia suficiente.";

const req = (ctx: TenantContext, method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/v1/exam-plans", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": ctx.tenantId,
      "x-dev-user": ctx.userId,
      "x-dev-role": ctx.role,
    },
  });

(enabled ? describe : describe.skip)("exam plans (NOB-150)", () => {
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
    await admin`insert into medicos (id, org_id, name, crm, profession, registration_uf, rqe, affiliation, status)
      values (${MEDICO}, 'org_a', 'Dra. Coordenadora Fictícia', '50001', 'physician', 'MA', '951', 'internal', 'active')`;
    await admin`insert into pcmso_coordinator_assignments (org_id, company_id, medico_id, starts_on, created_by)
      values ('org_a', ${I.companyA}, ${MEDICO}, '2026-01-01', 'owner')`;
    await admin`update risks set noxious_agent_code='02.01.001' where id=${I.riskA}`;
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

  it("equipe prepara o rascunho a partir da proposta, com proveniência e trilha", async () => {
    const plan = await createDraft(staff, I.companyA);
    expect(plan).toMatchObject({ version: 1, status: "draft", preparedBy: "staff" });
    const detail = await getPlan(staff, plan.id);
    expect(detail.canDecide).toBe(false);
    expect(detail.items).toEqual([
      expect.objectContaining({
        procedureCode: "0281",
        origin: "suggested",
        ruleId: "nr7-anexo-ii-audiometria",
        decision: "kept",
      }),
    ]);
    expect(detail.basedOn).toMatchObject({
      sources: [expect.objectContaining({ kind: "internal" })],
    });
    expect(detail.events.map((e) => e.event)).toEqual(["draft_created"]);
    const dup = await createExamPlanDraftAction(I.companyA);
    expect(!dup.ok && dup.error.code).toBe("DUPLICATE");
  });

  it("só a coordenadora vinculada decide, acrescenta e aprova; o papel de owner não basta", async () => {
    const plan = await createDraft(staff, I.companyA);
    const [item] = (await getPlan(staff, plan.id)).items;
    (requireOfficeStaff as jest.Mock).mockResolvedValue(owner);
    const byOwner = await decideExamPlanItemAction(plan.id, item.id, {
      decision: "removed",
      periodicity: "Anual",
      justification: WHY,
    });
    expect(!byOwner.ok && byOwner.error.code).toBe("FORBIDDEN");
    const addOwner = await addExamPlanItemAction(plan.id, {
      exposureGroup: "Produção",
      code: "1057",
      periodicity: "Bienal",
      justification: WHY,
    });
    expect(!addOwner.ok && addOwner.error.code).toBe("FORBIDDEN");
    const approveOwner = await approveExamPlanAction(plan.id, {});
    expect(!approveOwner.ok && approveOwner.error.code).toBe("FORBIDDEN");
    expect((await getPlan(doctor, plan.id)).canDecide).toBe(true);
  });

  it("RLS barra decisão e aprovação de quem não é a coordenadora, mesmo por SQL direto", async () => {
    const plan = await createDraft(staff, I.companyA);
    const asActor = (
      user: string,
      fn: (tx: postgres.TransactionSql) => Promise<unknown>,
    ) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_org', 'org_a', true), set_config('app.current_actor', ${user}, true)`;
        return fn(tx);
      });
    expect(
      await asActor(
        "owner",
        (tx) =>
          tx`update medical_exam_plan_items set decision='removed', justification='forjado por SQL', updated_by='owner' where plan_id=${plan.id} returning id`,
      ),
    ).toHaveLength(0);
    expect(
      await asActor(
        "owner",
        (tx) =>
          tx`update medical_exam_plans set status='approved', approved_by_user='owner', approved_by_medico_id=${MEDICO}, approved_at=now() where id=${plan.id} returning id`,
      ),
    ).toHaveLength(0);
    // Coordenadora não pode aprovar em nome de outra conta.
    await expect(
      asActor(
        "doctor",
        (tx) =>
          tx`update medical_exam_plans set status='approved', approved_by_user='owner', approved_by_medico_id=${MEDICO}, approved_at=now() where id=${plan.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asActor(
        "doctor",
        (tx) => tx`delete from medical_exam_plan_items where plan_id=${plan.id}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (await admin`select status from medical_exam_plans where id=${plan.id}`)[0].status,
    ).toBe("draft");
  });

  it("decisões exigem justificativa; código fora da Tabela 27 é recusado", async () => {
    const plan = await createDraft(staff, I.companyA);
    const [item] = (await getPlan(staff, plan.id)).items;
    (requireOfficeStaff as jest.Mock).mockResolvedValue(doctor);
    const noWhy = await decideExamPlanItemAction(plan.id, item.id, {
      decision: "removed",
      periodicity: "Anual",
    });
    expect(!noWhy.ok && noWhy.error.code).toBe("VALIDATION");
    const invented = await addExamPlanItemAction(plan.id, {
      exposureGroup: "Produção",
      code: "0000",
      periodicity: "Anual",
      justification: WHY,
    });
    expect(!invented.ok && invented.error.code).toBe("VALIDATION");
    const other = await addExamPlanItemAction(plan.id, {
      exposureGroup: "Produção",
      code: "9999",
      periodicity: "Anual",
      justification: WHY,
    });
    expect(!other.ok && other.error.code).toBe("VALIDATION");
  });

  it("NOB-112: decisão em exame acrescentado sem justificativa é recusada com mensagem clara e nada muda; a justificativa persiste e é retomada", async () => {
    const plan = await createDraft(staff, I.companyA);
    const [suggested] = (await getPlan(staff, plan.id)).items;
    const added = await addItem(doctor, plan.id, {
      exposureGroup: "Produção",
      code: "1057",
      periodicity: "Anual",
      justification: WHY,
    });
    (requireOfficeStaff as jest.Mock).mockResolvedValue(doctor);

    // Antes da correção: o CHECK do banco recusava (23514) e a tela só dizia "Valor fora do permitido.".
    const noWhy = await decideExamPlanItemAction(plan.id, added.id, {
      decision: "kept",
      periodicity: "Admissional e a cada dois anos",
    });
    expect(noWhy.ok).toBe(false);
    expect(!noWhy.ok && noWhy.error).toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/acrescentado pelo médico exige justificativa/),
    });
    const unchanged = (await getPlan(staff, plan.id)).items.find(
      (i) => i.id === added.id,
    )!;
    expect(unchanged).toMatchObject({ periodicity: "Anual", justification: WHY });

    // REST: mesma regra e mesmo código (422), sem reimplementar.
    const restRes = await DECIDE(
      req(doctor, "PUT", { decision: "kept", periodicity: "Semestral" }),
      { params: Promise.resolve({ id: plan.id, itemId: added.id }) },
    );
    expect(restRes.status).toBe(422);

    // Com a justificativa (a tela agora a traz preenchida), a periodicidade muda e a justificativa fica.
    const ok = await decideExamPlanItemAction(plan.id, added.id, {
      decision: "kept",
      periodicity: "Admissional e a cada dois anos",
      justification: WHY,
    });
    expect(ok.ok).toBe(true);
    const reloaded = (await getPlan(staff, plan.id)).items.find(
      (i) => i.id === added.id,
    )!;
    expect(reloaded).toMatchObject({
      periodicity: "Admissional e a cada dois anos",
      justification: WHY,
      origin: "added",
    });

    // Item sugerido e mantido: justificativa é opcional e limpá-la de propósito grava nulo.
    await decideItem(doctor, plan.id, suggested.id, {
      decision: "kept",
      periodicity: "Anual",
      justification: WHY,
    });
    await decideItem(doctor, plan.id, suggested.id, {
      decision: "kept",
      periodicity: "Anual",
    });
    expect(
      (await getPlan(staff, plan.id)).items.find((i) => i.id === suggested.id),
    ).toMatchObject({ justification: null });

    // Retirar exige justificativa, inclusive em item acrescentado (regra existente, inalterada).
    const removeNoWhy = await decideExamPlanItemAction(plan.id, added.id, {
      decision: "removed",
      periodicity: "Anual",
    });
    expect(!removeNoWhy.ok && removeNoWhy.error.fields).toMatchObject({
      justification: "Justifique a retirada do exame.",
    });

    // Outro escritório não alcança o item; a equipe sem vínculo segue sem decidir.
    await expect(
      decideItem(ownerB, plan.id, added.id, {
        decision: "kept",
        periodicity: "Anual",
        justification: WHY,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      decideItem(staff, plan.id, added.id, {
        decision: "kept",
        periodicity: "Anual",
        justification: WHY,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("aprovação: itens decididos, aprovado imutável, nova versão substitui a anterior, trilha completa", async () => {
    const v1 = await createDraft(staff, I.companyA);
    const [item] = (await getPlan(staff, v1.id)).items;
    await decideItem(doctor, v1.id, item.id, {
      decision: "kept",
      periodicity: "Admissional, anual e demissional",
    });
    const added = await addItem(doctor, v1.id, {
      exposureGroup: "Produção",
      code: "1057",
      periodicity: "Admissional e a cada dois anos",
      justification: WHY,
    });
    expect(added).toMatchObject({ origin: "added", createdBy: "doctor" });
    const approved = await approve(doctor, v1.id, { note: "Aprovação fictícia." });
    expect(approved).toMatchObject({
      status: "approved",
      approvedByUser: "doctor",
      approvedByMedicoId: MEDICO,
    });
    await expect(
      decideItem(doctor, v1.id, item.id, { decision: "kept", periodicity: "Semestral" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const v2 = await createDraft(staff, I.companyA);
    expect(v2.version).toBe(2);
    await approve(doctor, v2.id, {});
    const versions = await listPlans(staff, I.companyA);
    expect(versions.map((p) => [p.version, p.status])).toEqual([
      [2, "approved"],
      [1, "superseded"],
    ]);
    const trail = (await getPlan(staff, v1.id)).events.map((e) => e.event).sort();
    expect(trail).toEqual([
      "approved",
      "draft_created",
      "item_added",
      "item_decided",
      "superseded",
    ]);
  });

  it("NOB-112: exame repetido no mesmo grupo e função é recusado com mensagem clara e nada é inserido; aprovado não aceita acréscimo", async () => {
    const plan = await createDraft(staff, I.companyA);
    (requireOfficeStaff as jest.Mock).mockResolvedValue(doctor);
    const input = {
      exposureGroup: "Produção",
      code: "1057",
      periodicity: "Anual",
      justification: WHY,
    };
    const first = await addExamPlanItemAction(plan.id, input);
    expect(first.ok).toBe(true);
    const countAdded = async () =>
      (
        await admin`select count(*)::int as n from medical_exam_plan_items where plan_id=${plan.id} and origin='added'`
      )[0].n;

    // Antes da correção: o 23505 do índice único virava "Registro já existe neste escritório.".
    const again = await addExamPlanItemAction(plan.id, {
      ...input,
      periodicity: "Semestral",
    });
    expect(!again.ok && again.error).toEqual({
      code: "DUPLICATE",
      message: EXAM_PLAN_ITEM_DUPLICATE_MESSAGE,
    });
    const rest = await ADD(req(doctor, "POST", input), {
      params: Promise.resolve({ id: plan.id }),
    });
    expect(rest.status).toBe(409);
    expect(await rest.json()).toEqual({
      error: { code: "DUPLICATE", message: EXAM_PLAN_ITEM_DUPLICATE_MESSAGE },
    });
    expect(await countAdded()).toBe(1);
    const trail = (await getPlan(staff, plan.id)).events.filter(
      (e) => e.event === "item_added",
    );
    expect(trail).toHaveLength(1);

    // A regra de unicidade não mudou: o mesmo exame em outra função é outro item.
    const otherRole = await addExamPlanItemAction(plan.id, {
      ...input,
      jobRole: "Operador fictício",
    });
    expect(otherRole.ok).toBe(true);
    expect(await countAdded()).toBe(2);

    // Plano aprovado não muda: acrescentar segue recusado e nada é inserido.
    await approve(doctor, plan.id, {});
    const afterApproval = await addExamPlanItemAction(plan.id, {
      ...input,
      exposureGroup: "Manutenção",
    });
    expect(!afterApproval.ok && afterApproval.error).toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/Plano aprovado ou substituído não muda/),
    });
    expect(await countAdded()).toBe(2);
  });

  it("revogar o vínculo ou encerrar a designação tira o poder de decidir", async () => {
    const plan = await createDraft(staff, I.companyA);
    await admin`update medico_user_links set revoked_at=now(), revoked_by='owner', revoke_reason='Revogação fictícia.'`;
    await expect(approve(doctor, plan.id, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("isolamento e módulo", async () => {
    const plan = await createDraft(staff, I.companyA);
    await expect(getPlan(ownerB, plan.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createDraft(ownerB, I.companyA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await admin`update company_modules set enabled=false where company_id=${I.companyA} and module='medicine'`;
    await expect(listPlans(staff, I.companyA)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("REST: rascunho (201), detalhe, aprovação pela coordenadora e papéis", async () => {
    const company = { params: Promise.resolve({ id: I.companyA }) };
    const created = await DRAFT(req(staff, "POST"), company);
    expect(created.status).toBe(201);
    const { id } = await created.json();
    const plan = { params: Promise.resolve({ id }) };
    expect((await LIST(req(staff), company)).status).toBe(200);
    expect((await LIST(req({ ...owner, role: "client" }), company)).status).toBe(403);
    expect((await SHOW(req(ownerB), plan)).status).toBe(404);
    expect((await APPROVE(req(owner, "POST", {}), plan)).status).toBe(403);
    const ok = await APPROVE(req(doctor, "POST", { note: "Via REST." }), plan);
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe("approved");
  });
});
