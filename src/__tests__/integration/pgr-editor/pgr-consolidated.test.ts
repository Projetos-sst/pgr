/**
 * Integração da Server Action da visão consolidada do PGR contra Postgres efêmero.
 * O seed liga pgrA→gesA; gesA tem riskA (avaliação vigente nível 9) + controlMeasureA
 * (elimination, applicable=false → estado derivado without_plan).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { getPgrConsolidatedAction } from "@/shared/server/actions/pgr/pgr-consolidated";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

(shouldRun ? describe : describe.skip)("Server Actions — pgr_consolidated", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("agrega GES → riscos → avaliação vigente → medidas com estado derivado", async () => {
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data;
    expect(data.ges).toHaveLength(1);
    const g = data.ges[0];
    expect(g.id).toBe(PGR_IDS.gesA);
    expect(g.risks).toHaveLength(1);
    const risk = g.risks[0];
    expect(risk.id).toBe(PGR_IDS.riskA);
    expect(risk.riskLevel).toBe(9); // avaliação vigente (3×3)
    expect(risk.measures).toHaveLength(1);
    expect(risk.measures[0].state).toBe("without_plan"); // controlMeasureA applicable=false
  });

  it("traz EPIs indicados por risco (seed liga epiCatalogA↔riskA)", async () => {
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const risk = result.data.ges[0].risks[0];
    expect(risk.epis).toHaveLength(1);
    expect(risk.epis[0].name).toBe("Capacete CA-123");
    expect(risk.epis[0].neutralization).toBe("neutralizes");
  });

  it("traz o 5W2H completo e a avaliação detalhada", async () => {
    await admin.unsafe(`
      update public.control_measures
        set action_what='Trocar equipamento', action_how='Compra',
            action_tracking='Mensal', action_measurement='dB', action_responsible='SESMT',
            action_deadline='2026-12-31', justification='NR-01', monitoring='Anual'
      where org_id='org_a' and id='${PGR_IDS.controlMeasureA}'`);
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const risk = result.data.ges[0].risks[0];
    const m = risk.measures[0];
    expect(m.actionWhat).toBe("Trocar equipamento");
    expect(m.actionHow).toBe("Compra");
    expect(m.actionTracking).toBe("Mensal");
    expect(m.actionMeasurement).toBe("dB");
    expect(m.justification).toBe("NR-01");
    expect(m.monitoring).toBe("Anual");
    // Avaliação vigente detalhada (seed: 3×3 qualitativa).
    expect(risk.assessment).not.toBeNull();
    expect(risk.assessment?.probability).toBe(3);
    expect(risk.assessment?.severity).toBe(3);
    expect(risk.assessment?.riskLevel).toBe(9);
  });

  it("expõe os campos eSocial S-2240 já persistidos", async () => {
    await admin.unsafe(`
      update public.risks
        set noxious_agent_code='01.01.001', measurement_unit='db_a',
            concentration_intensity='85.5', exposure_time='gt_7h', sources='Máquinas'
      where org_id='org_a' and id='${PGR_IDS.riskA}'`);
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const risk = result.data.ges[0].risks[0];
    expect(risk.noxiousAgentCode).toBe("01.01.001");
    expect(risk.measurementUnit).toBe("db_a");
    expect(risk.concentrationIntensity).toBe("85.5"); // numeric → string
    expect(risk.exposureTime).toBe("gt_7h");
    expect(risk.sources).toBe("Máquinas");
  });

  it("fallbacks: risco sem avaliação / sem medida / sem EPI", async () => {
    await admin.unsafe(
      `delete from public.risk_assessments where org_id='org_a' and risk_id='${PGR_IDS.riskA}'`,
    );
    await admin.unsafe(
      `delete from public.control_measures where org_id='org_a' and risk_id='${PGR_IDS.riskA}'`,
    );
    await admin.unsafe(
      `delete from public.epi_risk where org_id='org_a' and risk_id='${PGR_IDS.riskA}'`,
    );
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const risk = result.data.ges[0].risks[0];
    expect(risk.riskLevel).toBeNull();
    expect(risk.assessment).toBeNull();
    expect(risk.measures).toEqual([]);
    expect(risk.epis).toEqual([]);
  });

  it("GES sem riscos → risks vazio (fallback)", async () => {
    await admin.unsafe(
      `delete from public.risks where org_id='org_a' and ges_id='${PGR_IDS.gesA}'`,
    );
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok && result.data.ges[0].risks).toEqual([]);
  });

  it("PGR sem GES → ges vazio (fallback)", async () => {
    // remove o único vínculo do pgrA
    await admin.unsafe(
      `delete from public.pgr_ges where org_id='org_a' and pgr_id='${PGR_IDS.pgrA}'`,
    );
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok && result.data.ges).toEqual([]);
  });

  it("PGR inexistente/cross-tenant → NOT_FOUND", async () => {
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrB); // pgrB é de org_b
    expect(!result.ok && result.error.code).toBe("NOT_FOUND");
  });

  it("não vaza dados de outro tenant (consolidada de org_a não traz gesB/riskB)", async () => {
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const gesIds = result.data.ges.map((g) => g.id);
      expect(gesIds).not.toContain(PGR_IDS.gesB);
    }
  });
});
