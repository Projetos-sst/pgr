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

  it("traz identificação completa da empresa e da unidade, com preposto (#47)", async () => {
    await admin.unsafe(`
      update public.companies
        set nome_fantasia='A Fantasia', cnae='4120-4/00', main_activity='Construção',
            risk_grade=3, zip_code='20040-020', street='Avenida Rio Branco', number='156',
            district='Centro', city='Rio de Janeiro', state='RJ'
      where org_id='org_a' and id='${PGR_IDS.companyA}';
      update public.work_units
        set type='site', contract_number='CT-2026/001', manager_name='Fulano Preposto',
            manager_role='Encarregado de obra', professional_title='Engenheiro Civil',
            professional_registration='CREA-RJ 99999', start_date='2026-01-02',
            expected_end_date='2027-01-02', city='Rio de Janeiro', state='RJ'
      where org_id='org_a' and id='${PGR_IDS.workUnitA}';`);

    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { company, workUnit } = result.data.pgr;
    expect(company?.cnpj).toBe("11222333000181");
    expect(company?.nomeFantasia).toBe("A Fantasia");
    expect(company?.riskGrade).toBe(3);
    expect(company?.address.city).toBe("Rio de Janeiro");
    // Preposto = manager_name/manager_role da unidade (validado na auditoria do Lote 2).
    expect(workUnit?.managerName).toBe("Fulano Preposto");
    expect(workUnit?.managerRole).toBe("Encarregado de obra");
    expect(workUnit?.professionalRegistration).toBe("CREA-RJ 99999");
  });

  it("traz por quê e custo da medida (5W2H completo, #47)", async () => {
    await admin.unsafe(`
      update public.control_measures
        set applicable=true, action_what='Enclausurar compressor',
            action_why='Exposição acima do limite medido na NHO-01',
            action_how='Cabine acústica', action_responsible='SESMT',
            action_deadline='2026-12-31', action_cost=15000.00
      where org_id='org_a' and id='${PGR_IDS.controlMeasureA}'`);

    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const measure = result.data.ges[0].risks[0].measures[0];
    expect(measure.actionWhy).toBe("Exposição acima do limite medido na NHO-01");
    expect(Number(measure.actionCost)).toBe(15000);
  });

  it("medida sem por quê/custo devolve null — nada é preenchido pelo sistema", async () => {
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const measure = result.data.ges[0].risks[0].measures[0];
    expect(measure.actionWhy).toBeNull();
    expect(measure.actionCost).toBeNull();
  });

  it("traz a avaliação quantitativa NR-09 da avaliação vigente (#39)", async () => {
    await admin.unsafe(`
      update public.risk_assessments
        set criterion='quantitative', evaluation_method='NHO-01 (ruído)',
            measured_value=87.5, measured_unit='db_a', tolerance_limit_value=85,
            nr09_conclusion='above_limit'
      where org_id='org_a' and id='${PGR_IDS.riskAssessmentA}'`);

    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const assessment = result.data.ges[0].risks[0].assessment;
    expect(assessment?.evaluationMethod).toBe("NHO-01 (ruído)");
    expect(Number(assessment?.measuredValue)).toBe(87.5);
    expect(assessment?.measuredUnit).toBe("db_a");
    expect(assessment?.nr09Conclusion).toBe("above_limit");
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
