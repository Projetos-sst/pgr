/**
 * Integração do acoplamento **unidirecional** planos → ciclo de vida do incidente (Fase 06,
 * US5) contra Postgres efêmero: primeiro plano avança o incidente, planos ativos bloqueiam a
 * conclusão, cancelado/concluído resolvem, transação atômica. Não imprime dado médico.
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
import {
  createAccidentAction,
  getAccidentAction,
  setAccidentStatusAction,
} from "@/shared/server/actions/safety/accidents";
import {
  createActionPlanAction,
  setActionPlanStatusAction,
} from "@/shared/server/actions/safety/action-plans";
import { createActionPlan } from "@/shared/db/repositories/action-plans";

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
  what: "Ação corretiva",
  why: "Tratar o incidente",
  who: "SESMT",
  where: "Local",
  how: "Procedimento",
};

/** Cria um incidente e o leva a `awaiting_planning` (estado elegível ao avanço automático). */
async function incidentAwaitingPlanning(): Promise<string> {
  const created = await createAccidentAction({
    companyId: PGR_IDS.companyA,
    occurredAt: "2026-07-10T14:30:00Z",
    type: "typical",
    category: "without_leave",
    severity: "minor",
  });
  if (!created.ok) throw new Error("incident setup");
  await setAccidentStatusAction(created.data.id, { status: "awaiting_planning" });
  return created.data.id;
}

async function statusOf(id: string): Promise<string> {
  const r = await getAccidentAction(id);
  if (!r.ok) throw new Error("get incident");
  return r.data.status;
}

async function planFor(incidentId: string) {
  const r = await createActionPlanAction({
    originType: "incident",
    originId: incidentId,
    ...FIVE_W2H,
  });
  if (!r.ok) throw new Error(`plan setup: ${r.error.code}`);
  return r.data.id;
}

(shouldRun ? describe : describe.skip)("Incident lifecycle × planos (US5)", () => {
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

  it("14. primeiro plano ativo avança awaiting_planning → awaiting_completion", async () => {
    const incidentId = await incidentAwaitingPlanning();
    await planFor(incidentId);
    expect(await statusOf(incidentId)).toBe("awaiting_completion");
  });

  it("14b. incidente `registered` NÃO avança automaticamente com o plano", async () => {
    const created = await createAccidentAction({
      companyId: PGR_IDS.companyA,
      occurredAt: "2026-07-10T14:30:00Z",
      type: "typical",
      category: "without_leave",
      severity: "minor",
    });
    if (!created.ok) throw new Error("setup");
    await planFor(created.data.id);
    expect(await statusOf(created.data.id)).toBe("registered");
  });

  it("15. segundo plano não duplica a transição (permanece awaiting_completion)", async () => {
    const incidentId = await incidentAwaitingPlanning();
    await planFor(incidentId);
    await planFor(incidentId);
    expect(await statusOf(incidentId)).toBe("awaiting_completion");
  });

  it("16. incidente com plano `planned` não conclui", async () => {
    const incidentId = await incidentAwaitingPlanning();
    await planFor(incidentId); // planned, avança para awaiting_completion
    const done = await setAccidentStatusAction(incidentId, {
      status: "completed",
      justification: "Tentativa",
    });
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.error.code).toBe("VALIDATION");
  });

  it("17. incidente com plano `in_progress` não conclui", async () => {
    const incidentId = await incidentAwaitingPlanning();
    const planId = await planFor(incidentId);
    await setActionPlanStatusAction(planId, { status: "in_progress" });
    const done = await setAccidentStatusAction(incidentId, {
      status: "completed",
      justification: "Tentativa",
    });
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.error.code).toBe("VALIDATION");
  });

  it("18. todos os planos concluídos permitem a conclusão do incidente", async () => {
    const incidentId = await incidentAwaitingPlanning();
    const planId = await planFor(incidentId);
    await setActionPlanStatusAction(planId, { status: "completed" });
    const done = await setAccidentStatusAction(incidentId, {
      status: "completed",
      justification: "Ações tratadas",
    });
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.data.status).toBe("completed");
      expect(done.data.completedAt).not.toBeNull();
    }
  });

  it("19. planos cancelados contam como resolvidos", async () => {
    const incidentId = await incidentAwaitingPlanning();
    const planId = await planFor(incidentId);
    await setActionPlanStatusAction(planId, { status: "cancelled" });
    const done = await setAccidentStatusAction(incidentId, {
      status: "completed",
      justification: "Planos cancelados",
    });
    expect(done.ok).toBe(true);
  });

  it("20. conclusão exige justificativa mesmo sem planos ativos", async () => {
    const incidentId = await incidentAwaitingPlanning();
    const planId = await planFor(incidentId);
    await setActionPlanStatusAction(planId, { status: "completed" });
    const noJustif = await setAccidentStatusAction(incidentId, { status: "completed" });
    expect(noJustif.ok).toBe(false);
    if (!noJustif.ok) expect(noJustif.error.code).toBe("VALIDATION");
  });

  it("21. plano + avanço do incidente são atômicos (ambos comitados juntos)", async () => {
    const incidentId = await incidentAwaitingPlanning();
    await planFor(incidentId);
    const [{ plans }] = await admin<{ plans: number }[]>`
      select count(*)::int as plans from public.action_plans
      where org_id = 'org_a' and origin_type = 'incident' and origin_id = ${incidentId}`;
    expect(plans).toBe(1);
    expect(await statusOf(incidentId)).toBe("awaiting_completion");
  });

  it("22. rollback do plano NÃO avança o incidente (transação atômica)", async () => {
    const incidentId = await incidentAwaitingPlanning();
    // priority 5 viola o CHECK (1..3) → o INSERT do plano falha e a transação inteira
    // (incluindo o avanço do incidente) sofre rollback.
    await expect(
      createActionPlan("org_a", {
        originType: "incident",
        originId: incidentId,
        ...FIVE_W2H,
        when: undefined,
        howMuch: undefined,
        priority: 5,
      }),
    ).rejects.toThrow();

    expect(await statusOf(incidentId)).toBe("awaiting_planning");
    const [{ plans }] = await admin<{ plans: number }[]>`
      select count(*)::int as plans from public.action_plans where org_id = 'org_a'`;
    expect(plans).toBe(0);
  });
});
