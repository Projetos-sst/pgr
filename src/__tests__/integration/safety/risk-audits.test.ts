/**
 * Integração das Server Actions + repositório de Auditorias de Risco + sugestão 5W2H por IA
 * (Fase 06, US7) contra Postgres efêmero. O único ponto de rede (LLM) é **mockado**; a
 * persistência/isolamento/cota rodam de verdade. Nunca imprime prompt/PII/dado médico.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));
jest.mock("@/shared/integrations/ai/anthropic", () => ({
  requestActionPlanSuggestion: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import { AiUnavailableError } from "@/shared/errors/ai-unavailable-error";
import { requestActionPlanSuggestion } from "@/shared/integrations/ai/anthropic";
import {
  createRiskAuditAction,
  getRiskAuditAction,
  listRiskAuditsAction,
  setRiskAuditStatusAction,
  suggestActionPlanAction,
} from "@/shared/server/actions/safety/risk-audits";
import { createActionPlanAction } from "@/shared/server/actions/safety/action-plans";
import { createAccidentAction } from "@/shared/server/actions/safety/accidents";
import { ACTION_PLAN_SUGGESTION_KIND } from "@/shared/domains/safety/action-plan-suggestion";
import { FREE_AI_SUGGESTION_MONTHLY_QUOTA } from "@/shared/tenant/plan";

import { adminClient, appRuntimeClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const mockedModel = requestActionPlanSuggestion as jest.MockedFunction<
  typeof requestActionPlanSuggestion
>;

function asOwner(tenantId: string, plan: "free" | "pro" = "free") {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan, role: "owner" });
}

const VALID_5W2H = {
  what: "Instalar enclausuramento acústico",
  why: "Reduzir exposição ao ruído",
  who: "SESMT",
  where: "Usinagem",
  how: "Barreira acústica na fonte",
  when: "2026-09-01",
  howMuch: 2500,
  priority: 2,
};

/** Cria um incidente com dados sensíveis (hospital/testemunhas/funcionário) p/ provar a allowlist. */
async function createSensitiveIncident(): Promise<string> {
  const r = await createAccidentAction({
    companyId: PGR_IDS.companyA,
    employeeId: PGR_IDS.employeeA,
    occurredAt: "2026-07-10T14:30:00Z",
    type: "typical",
    category: "with_leave",
    severity: "severe",
    location: "Setor de usinagem",
    description: "Contato com peça em movimento",
    causes: "Proteção removida",
    hospital: "Hospital Central",
    witnesses: "Testemunha X",
    investigationNotes: "notas médicas detalhadas",
    injuryNatureDescription: "fratura exposta",
    bodyPartDescription: "mão direita",
  });
  if (!r.ok) throw new Error(`incident setup: ${r.error.code}`);
  return r.data.id;
}

(shouldRun ? describe : describe.skip)("Server Actions — risk_audits + IA (US7)", () => {
  let admin: ReturnType<typeof postgres>;
  let runtime: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    runtime = appRuntimeClient();
  });

  afterAll(async () => {
    await runtime.end({ timeout: 5 });
    await admin.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    mockedModel.mockReset();
    asOwner("org_a");
  });

  // ── Auditorias: origem, uma-ativa, transições ──────────────────────────────

  it("1. cria auditoria para risco válido (awaiting_analysis)", async () => {
    const r = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("awaiting_analysis");
  });

  it("2. cria auditoria para incidente válido", async () => {
    const incidentId = await createSensitiveIncident();
    const r = await createRiskAuditAction({
      originType: "incident",
      originId: incidentId,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.originType).toBe("incident");
  });

  it("3. origem inexistente → FK_NOT_FOUND (422)", async () => {
    const r = await createRiskAuditAction({
      originType: "risk",
      originId: "99999999-9999-9999-9999-999999999999",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FK_NOT_FOUND");
  });

  it("4. origem cross-tenant → FK_NOT_FOUND (422)", async () => {
    const r = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskB,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FK_NOT_FOUND");
  });

  it("5. auditoria cross-tenant → NOT_FOUND (404)", async () => {
    asOwner("org_b");
    const created = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskB,
    });
    if (!created.ok) throw new Error("setup");
    asOwner("org_a");
    const fetched = await getRiskAuditAction(created.data.id);
    expect(fetched.ok).toBe(false);
    if (!fetched.ok) expect(fetched.error.code).toBe("NOT_FOUND");
  });

  it("6/7. uma auditoria ativa por origem → IN_USE (409)", async () => {
    const first = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    expect(first.ok).toBe(true);
    const second = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("IN_USE");
    // Só uma ativa persistiu.
    const [{ n }] = await admin<{ n: number }[]>`
      select count(*)::int as n from public.risk_audits
      where org_id = 'org_a' and origin_id = ${PGR_IDS.riskA} and status <> 'completed'`;
    expect(n).toBe(1);
  });

  it("8. auditoria concluída permite nova auditoria para a mesma origem", async () => {
    const first = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    if (!first.ok) throw new Error("setup");
    await setRiskAuditStatusAction(first.data.id, { status: "planning_actions" });
    await setRiskAuditStatusAction(first.data.id, {
      status: "completed",
      justification: "Ações planejadas",
    });
    const second = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    expect(second.ok).toBe(true);
  });

  it("9/10/13. transições preenchem started_at/completed_at", async () => {
    const created = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    if (!created.ok) throw new Error("setup");
    const planning = await setRiskAuditStatusAction(created.data.id, {
      status: "planning_actions",
    });
    expect(planning.ok).toBe(true);
    if (planning.ok) {
      expect(planning.data.startedAt).not.toBeNull();
      expect(planning.data.completedAt).toBeNull();
    }
    const done = await setRiskAuditStatusAction(created.data.id, {
      status: "completed",
      justification: "Concluída",
    });
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.data.completedAt).not.toBeNull();
      expect(done.data.justification).toBe("Concluída");
    }
  });

  it("11. transição inválida (pula etapa / terminal) → VALIDATION (422)", async () => {
    const created = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    if (!created.ok) throw new Error("setup");
    const skip = await setRiskAuditStatusAction(created.data.id, { status: "completed" });
    expect(skip.ok).toBe(false);
    if (!skip.ok) expect(skip.error.code).toBe("VALIDATION");
  });

  it("12. conclusão exige justificativa → VALIDATION", async () => {
    const created = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    if (!created.ok) throw new Error("setup");
    await setRiskAuditStatusAction(created.data.id, { status: "planning_actions" });
    const noJustif = await setRiskAuditStatusAction(created.data.id, {
      status: "completed",
    });
    expect(noJustif.ok).toBe(false);
    if (!noJustif.ok) expect(noJustif.error.code).toBe("VALIDATION");
  });

  it("14. filtros e paginação", async () => {
    const incidentId = await createSensitiveIncident();
    await createRiskAuditAction({ originType: "risk", originId: PGR_IDS.riskA });
    await createRiskAuditAction({ originType: "incident", originId: incidentId });

    const all = await listRiskAuditsAction({});
    expect(all.ok && all.data.total).toBe(2);
    const byOrigin = await listRiskAuditsAction({ originType: "incident" });
    expect(byOrigin.ok && byOrigin.data.rows).toHaveLength(1);
    const byStatus = await listRiskAuditsAction({ status: "awaiting_analysis" });
    expect(byStatus.ok && byStatus.data.total).toBe(2);
    const paged = await listRiskAuditsAction({ page: 1, pageSize: 1 });
    expect(paged.ok && paged.data.rows).toHaveLength(1);
  });

  it("15. origem removida não quebra a listagem", async () => {
    const created = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    if (!created.ok) throw new Error("setup");
    await admin`delete from public.risks where id = ${PGR_IDS.riskA}`;
    const list = await listRiskAuditsAction({});
    expect(list.ok && list.data.rows[0].origin.removed).toBe(true);
    const detail = await getRiskAuditAction(created.data.id);
    expect(detail.ok).toBe(true);
    if (detail.ok) expect(detail.data.origin.removed).toBe(true);
  });

  it("16/17. detalhe mostra planos da origem; plano não recebe risk_audit_id", async () => {
    const created = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    if (!created.ok) throw new Error("setup");
    const plan = await createActionPlanAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
      what: "Plano manual",
      why: "Tratar",
      who: "SESMT",
      where: "Usinagem",
      how: "Barreira",
    });
    expect(plan.ok).toBe(true);
    const detail = await getRiskAuditAction(created.data.id);
    expect(detail.ok).toBe(true);
    if (detail.ok) expect(detail.data.plans).toHaveLength(1);
    // A tabela action_plans não tem coluna risk_audit_id (vínculo é por origem).
    const [{ has }] = await admin<{ has: number }[]>`
      select count(*)::int as has from information_schema.columns
      where table_name = 'action_plans' and column_name = 'risk_audit_id'`;
    expect(has).toBe(0);
  });

  // ── Sugestão por IA (mock determinístico) ──────────────────────────────────

  it("18. sugestão IA para risco devolve 5W2H e grava kind action_plan_suggestion", async () => {
    mockedModel.mockResolvedValue(VALID_5W2H);
    const r = await suggestActionPlanAction("risk", PGR_IDS.riskA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.suggestion.what).toBe(VALID_5W2H.what);
    const [{ kind }] = await admin<{ kind: string }[]>`
      select kind from public.ai_usage_events where org_id = 'org_a' limit 1`;
    expect(kind).toBe(ACTION_PLAN_SUGGESTION_KIND);
  });

  it("19. sugestão IA para incidente envia input SANITIZADO (sem PII/dado médico)", async () => {
    const incidentId = await createSensitiveIncident();
    mockedModel.mockResolvedValue(VALID_5W2H);
    const r = await suggestActionPlanAction("incident", incidentId);
    expect(r.ok).toBe(true);
    expect(mockedModel).toHaveBeenCalledTimes(1);
    const input = mockedModel.mock.calls[0][0] as Record<string, unknown>;
    for (const forbidden of [
      "employeeId",
      "hospital",
      "witnesses",
      "investigationNotes",
      "injuryNatureDescription",
      "bodyPartDescription",
      "companyId",
      "id",
    ]) {
      expect(input).not.toHaveProperty(forbidden);
    }
    expect(input.kind).toBe("incident");
    expect(input.type).toBe("typical");
  });

  it("20. output inválido do provedor → AI_UNAVAILABLE (não consome cota)", async () => {
    mockedModel.mockResolvedValue({ what: "incompleto" });
    const r = await suggestActionPlanAction("risk", PGR_IDS.riskA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("AI_UNAVAILABLE");
    const [{ n }] = await admin<{ n: number }[]>`
      select count(*)::int as n from public.ai_usage_events where org_id = 'org_a'`;
    expect(n).toBe(0);
  });

  it("21. timeout/erro do provedor → AI_UNAVAILABLE", async () => {
    mockedModel.mockRejectedValue(new AiUnavailableError());
    const r = await suggestActionPlanAction("risk", PGR_IDS.riskA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("AI_UNAVAILABLE");
  });

  it("22/23. plano free respeita a cota de 20/mês → 21ª sugestão QUOTA_EXCEEDED", async () => {
    await admin.unsafe(
      `insert into public.ai_usage_events (org_id, kind)
       select 'org_a', '${ACTION_PLAN_SUGGESTION_KIND}'
       from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA})`,
    );
    const r = await suggestActionPlanAction("risk", PGR_IDS.riskA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("QUOTA_EXCEEDED");
    expect(mockedModel).not.toHaveBeenCalled();
  });

  it("24. plano pro ignora a cota mensal", async () => {
    await admin.unsafe(
      `insert into public.ai_usage_events (org_id, kind)
       select 'org_a', '${ACTION_PLAN_SUGGESTION_KIND}'
       from generate_series(1, ${FREE_AI_SUGGESTION_MONTHLY_QUOTA + 5})`,
    );
    asOwner("org_a", "pro");
    mockedModel.mockResolvedValue(VALID_5W2H);
    const r = await suggestActionPlanAction("risk", PGR_IDS.riskA);
    expect(r.ok).toBe(true);
    expect(mockedModel).toHaveBeenCalledTimes(1);
  });

  it("26/27. sugestão não persiste plano e não altera a auditoria", async () => {
    const audit = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    if (!audit.ok) throw new Error("setup");
    mockedModel.mockResolvedValue(VALID_5W2H);
    await suggestActionPlanAction("risk", PGR_IDS.riskA);
    const [{ plans }] = await admin<{ plans: number }[]>`
      select count(*)::int as plans from public.action_plans where org_id = 'org_a'`;
    expect(plans).toBe(0);
    const after = await getRiskAuditAction(audit.data.id);
    expect(after.ok && after.data.audit.status).toBe("awaiting_analysis");
  });

  // ── Segurança / isolamento ─────────────────────────────────────────────────

  it("28. papel client → FORBIDDEN (403)", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const list = await listRiskAuditsAction({});
    expect(list.ok).toBe(false);
    if (!list.ok) expect(list.error.code).toBe("FORBIDDEN");
    const create = await createRiskAuditAction({
      originType: "risk",
      originId: PGR_IDS.riskA,
    });
    expect(create.ok).toBe(false);
    if (!create.ok) expect(create.error.code).toBe("FORBIDDEN");
    const suggest = await suggestActionPlanAction("risk", PGR_IDS.riskA);
    expect(suggest.ok).toBe(false);
    if (!suggest.ok) expect(suggest.error.code).toBe("FORBIDDEN");
  });

  it("29. RLS: query bare (sem tenant) não enxerga auditorias", async () => {
    await createRiskAuditAction({ originType: "risk", originId: PGR_IDS.riskA });
    const bare = await runtime<{ id: string }[]>`select id from public.risk_audits`;
    expect(bare).toHaveLength(0);
  });

  it("32. control_measures permanece inalterado após operações de auditoria/IA", async () => {
    const [{ before }] = await admin<{ before: number }[]>`
      select count(*)::int as before from public.control_measures where org_id = 'org_a'`;
    await createRiskAuditAction({ originType: "risk", originId: PGR_IDS.riskA });
    mockedModel.mockResolvedValue(VALID_5W2H);
    await suggestActionPlanAction("risk", PGR_IDS.riskA);
    const [{ after }] = await admin<{ after: number }[]>`
      select count(*)::int as after from public.control_measures where org_id = 'org_a'`;
    expect(after).toBe(before);
    expect(before).toBeGreaterThan(0);
  });
});
