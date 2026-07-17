/**
 * Integração das Server Actions + repositório de Planos de Ação 5W2H (Fase 06, US6)
 * contra Postgres efêmero. Mocka o gate de papel, a URL do banco e next/cache.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError } from "@/shared/auth/errors";
import {
  createActionPlanAction,
  deleteActionPlanAction,
  getActionPlanAction,
  listActionPlansAction,
  setActionPlanStatusAction,
  updateActionPlanAction,
} from "@/shared/server/actions/safety/action-plans";
import { createAccidentAction } from "@/shared/server/actions/safety/accidents";

import { adminClient, appRuntimeClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

const FIVE_W2H = {
  what: "Instalar enclausuramento",
  why: "Reduzir ruído",
  who: "SESMT",
  where: "Usinagem",
  how: "Barreira acústica",
};

function riskPlan(over: Record<string, unknown> = {}) {
  return { originType: "risk" as const, originId: PGR_IDS.riskA, ...FIVE_W2H, ...over };
}

async function createIncident(): Promise<string> {
  const r = await createAccidentAction({
    companyId: PGR_IDS.companyA,
    occurredAt: "2026-07-10T14:30:00Z",
    type: "typical",
    category: "without_leave",
    severity: "minor",
  });
  if (!r.ok) throw new Error(`incident create falhou: ${r.error.code}`);
  return r.data.id;
}

(shouldRun ? describe : describe.skip)("Server Actions — action_plans (US6)", () => {
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
    asOwner("org_a");
  });

  it("1. cria plano para risco válido (status planned)", async () => {
    const r = await createActionPlanAction(riskPlan());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.status).toBe("planned");
      expect(r.data.originType).toBe("risk");
    }
  });

  it("2. cria plano para incidente válido", async () => {
    const incidentId = await createIncident();
    const r = await createActionPlanAction({
      originType: "incident",
      originId: incidentId,
      ...FIVE_W2H,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.originType).toBe("incident");
  });

  it("3. origem inexistente → FK_NOT_FOUND (422)", async () => {
    const r = await createActionPlanAction(
      riskPlan({ originId: "99999999-9999-9999-9999-999999999999" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FK_NOT_FOUND");
  });

  it("4. origem cross-tenant → FK_NOT_FOUND (422)", async () => {
    const r = await createActionPlanAction(riskPlan({ originId: PGR_IDS.riskB }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FK_NOT_FOUND");
  });

  it("5. origin_type não suportado → VALIDATION", async () => {
    const r = await createActionPlanAction(
      riskPlan({ originType: "inspection" }) as never,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION");
  });

  it("6. plano cross-tenant → NOT_FOUND (404)", async () => {
    asOwner("org_b");
    const created = await createActionPlanAction(riskPlan({ originId: PGR_IDS.riskB }));
    if (!created.ok) throw new Error("setup falhou");
    asOwner("org_a");
    const fetched = await getActionPlanAction(created.data.id);
    expect(fetched.ok).toBe(false);
    if (!fetched.ok) expect(fetched.error.code).toBe("NOT_FOUND");
  });

  it("7/8. CRUD, paginação e filtros por status/priority/origin", async () => {
    await createActionPlanAction(riskPlan({ priority: 1 }));
    await createActionPlanAction(riskPlan({ priority: 3, what: "Outro plano" }));
    const incidentId = await createIncident();
    await createActionPlanAction({
      originType: "incident",
      originId: incidentId,
      ...FIVE_W2H,
    });

    const all = await listActionPlansAction({});
    expect(all.ok && all.data.total).toBe(3);

    const byPriority = await listActionPlansAction({ priority: 3 });
    expect(byPriority.ok && byPriority.data.rows).toHaveLength(1);

    const byOrigin = await listActionPlansAction({ originType: "incident" });
    expect(byOrigin.ok && byOrigin.data.rows).toHaveLength(1);

    const byStatus = await listActionPlansAction({ status: "planned" });
    expect(byStatus.ok && byStatus.data.total).toBe(3);

    const paged = await listActionPlansAction({ page: 1, pageSize: 2 });
    expect(paged.ok && paged.data.rows).toHaveLength(2);
  });

  it("9. overdue é derivado (prazo passado + não terminal)", async () => {
    await createActionPlanAction(riskPlan({ when: "2020-01-01" }));
    const list = await listActionPlansAction({});
    expect(list.ok && list.data.rows[0].overdue).toBe(true);
    const overdueOnly = await listActionPlansAction({ overdue: true });
    expect(overdueOnly.ok && overdueOnly.data.rows).toHaveLength(1);
  });

  it("10/11. completed_at só na conclusão; cancelled_at só no cancelamento", async () => {
    const done = await createActionPlanAction(riskPlan());
    if (!done.ok) throw new Error("setup");
    const completed = await setActionPlanStatusAction(done.data.id, {
      status: "completed",
    });
    expect(completed.ok).toBe(true);
    if (completed.ok) {
      expect(completed.data.completedAt).not.toBeNull();
      expect(completed.data.cancelledAt).toBeNull();
    }

    const other = await createActionPlanAction(riskPlan());
    if (!other.ok) throw new Error("setup");
    const cancelled = await setActionPlanStatusAction(other.data.id, {
      status: "cancelled",
    });
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expect(cancelled.data.cancelledAt).not.toBeNull();
      expect(cancelled.data.completedAt).toBeNull();
    }
  });

  it("12. estado terminal não retrocede (VALIDATION)", async () => {
    const created = await createActionPlanAction(riskPlan());
    if (!created.ok) throw new Error("setup");
    await setActionPlanStatusAction(created.data.id, { status: "completed" });
    const back = await setActionPlanStatusAction(created.data.id, {
      status: "in_progress",
    });
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.error.code).toBe("VALIDATION");
  });

  it("13. origem removida mantém o plano como histórico (não quebra)", async () => {
    const created = await createActionPlanAction(riskPlan());
    if (!created.ok) throw new Error("setup");
    // Remove a origem (risco) diretamente; o plano não tem FK física.
    await admin`delete from public.risks where id = ${PGR_IDS.riskA}`;

    const detail = await getActionPlanAction(created.data.id);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.data.origin.removed).toBe(true);
      expect(detail.data.origin.title).toBeNull();
    }
    const list = await listActionPlansAction({});
    expect(list.ok && list.data.rows[0].origin.removed).toBe(true);
  });

  it("exclusão física só em planned; iniciado → IN_USE", async () => {
    const created = await createActionPlanAction(riskPlan());
    if (!created.ok) throw new Error("setup");
    await setActionPlanStatusAction(created.data.id, { status: "in_progress" });
    const blocked = await deleteActionPlanAction(created.data.id);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe("IN_USE");

    const planned = await createActionPlanAction(riskPlan());
    if (!planned.ok) throw new Error("setup");
    const ok = await deleteActionPlanAction(planned.data.id);
    expect(ok.ok).toBe(true);
  });

  it("update preserva origem e é bloqueado em terminal", async () => {
    const created = await createActionPlanAction(riskPlan());
    if (!created.ok) throw new Error("setup");
    const upd = await updateActionPlanAction(created.data.id, {
      ...FIVE_W2H,
      what: "Revisado",
      priority: 2,
    });
    expect(upd.ok).toBe(true);
    if (upd.ok) {
      expect(upd.data.what).toBe("Revisado");
      expect(upd.data.originId).toBe(PGR_IDS.riskA);
    }
    await setActionPlanStatusAction(created.data.id, { status: "cancelled" });
    const afterTerminal = await updateActionPlanAction(created.data.id, {
      ...FIVE_W2H,
      what: "Nope",
    });
    expect(afterTerminal.ok).toBe(false);
    if (!afterTerminal.ok) expect(afterTerminal.error.code).toBe("VALIDATION");
  });

  it("23. papel client → FORBIDDEN (403)", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const list = await listActionPlansAction({});
    expect(list.ok).toBe(false);
    if (!list.ok) expect(list.error.code).toBe("FORBIDDEN");
    const create = await createActionPlanAction(riskPlan());
    expect(create.ok).toBe(false);
    if (!create.ok) expect(create.error.code).toBe("FORBIDDEN");
  });

  it("24. RLS: query bare (sem tenant) não enxerga planos", async () => {
    await createActionPlanAction(riskPlan());
    const bare = await runtime<{ id: string }[]>`select id from public.action_plans`;
    expect(bare).toHaveLength(0);
  });

  it("26. control_measures permanece inalterado após operações de plano", async () => {
    const [{ before }] = await admin<{ before: number }[]>`
      select count(*)::int as before from public.control_measures where org_id = 'org_a'`;
    await createActionPlanAction(riskPlan());
    const [{ after }] = await admin<{ after: number }[]>`
      select count(*)::int as after from public.control_measures where org_id = 'org_a'`;
    expect(after).toBe(before);
    expect(before).toBeGreaterThan(0);
  });
});
