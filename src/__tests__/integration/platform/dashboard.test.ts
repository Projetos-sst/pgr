/**
 * Integração das agregações do dashboard (read-model) contra Postgres efêmero.
 * Mocka apenas a URL do banco (app runtime → efêmero). Prova que o summary de um
 * tenant conta só os dados do próprio tenant (isolamento multi-tenant).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import { getDashboardSummary } from "@/shared/db/repositories/dashboard";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

function countFor(rows: { key: string; count: number }[], key: string): number {
  return rows.find((r) => r.key === key)?.count ?? 0;
}

(shouldRun ? describe : describe.skip)("Dashboard — agregações read-model", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("conta apenas os dados do tenant (org_a)", async () => {
    const s = await getDashboardSummary("org_a");
    expect(s.kpis).toEqual({
      companies: 1,
      employees: 1,
      workUnits: 1,
      ges: 1,
      risks: 1,
      pgrs: 1,
    });
    // Risco A é physical; os demais grupos zerados.
    expect(countFor(s.risksByAgentType, "physical")).toBe(1);
    expect(countFor(s.risksByAgentType, "chemical")).toBe(0);
    // Medida A é applicable=false → nenhum plano de ação aplicável.
    expect(s.actionPlansByLevel.every((r) => r.count === 0)).toBe(true);
    // Entrega A está 'pending' (não assinada) → não conta como pendente de devolução.
    expect(s.pending.episPendingReturn).toBe(0);
    expect(s.pending.episLowStock).toBe(0);
  });

  it("isola de org_b: os KPIs de org_a não incluem a empresa/risco de org_b", async () => {
    const a = await getDashboardSummary("org_a");
    const b = await getDashboardSummary("org_b");
    expect(a.kpis.companies).toBe(1);
    expect(b.kpis.companies).toBe(1);
    // Risco de org_b é chemical; org_a não vê esse grupo.
    expect(countFor(a.risksByAgentType, "chemical")).toBe(0);
    expect(countFor(b.risksByAgentType, "chemical")).toBe(1);
    // Medida B (ppe, applicable) conta só para org_b.
    expect(countFor(b.actionPlansByLevel, "ppe")).toBe(1);
    expect(countFor(a.actionPlansByLevel, "ppe")).toBe(0);
    // Entrega B assinada com item não devolvido → pendência de devolução só em org_b.
    expect(b.pending.episPendingReturn).toBe(1);
    expect(a.pending.episPendingReturn).toBe(0);
  });
});
