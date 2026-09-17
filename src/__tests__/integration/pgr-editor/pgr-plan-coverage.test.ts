/**
 * Integração da cobertura do plano do PGR (#42) contra Postgres efêmero. O plano do PGR é feito das
 * medidas de controle; todo risco aparece no consolidado com `planCoverage` derivada, sem nenhuma
 * escrita automática. As medidas são inseridas direto pelo admin para montar estados que a regra de
 * escrita (repositório) não deixaria criar — exatamente o que acontece após uma reclassificação.
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
import type { ConsolidatedRisk } from "@/shared/domains/pgr/pgr-consolidated";
import { getPgrConsolidatedAction } from "@/shared/server/actions/pgr/pgr-consolidated";
import { deleteRiskAction } from "@/shared/server/actions/pgr/risks";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

const RISK_NO_MEASURE = "42424242-0000-0000-0000-000000000001";
const RISK_NOT_ASSESSED = "42424242-0000-0000-0000-000000000002";
const RISK_MODERATE = "42424242-0000-0000-0000-000000000003";
const MEASURE_MODERATE = "42424242-0000-0000-0000-0000000000a3";

type MeasureRow = {
  status: string | null;
  applicable: boolean;
  action_responsible: string | null;
  action_deadline: string | null;
  updated_at: Date;
};

async function seedCoverage(admin: ReturnType<typeof postgres>) {
  const { gesA, riskAssessmentA, controlMeasureA } = PGR_IDS;
  await admin.unsafe(`
    -- riskA: tolerável, medida mantida e aplicável sem responsável/prazo → coberto
    update public.risk_assessments set result = 'tolerable'
      where org_id = 'org_a' and id = '${riskAssessmentA}';
    update public.control_measures
      set applicable = true, status = 'maintain', action_what = 'Protetor auricular',
          action_how = 'Uso contínuo'
      where org_id = 'org_a' and id = '${controlMeasureA}';

    insert into public.risks (id, org_id, ges_id, agent_type, description) values
      ('${RISK_NO_MEASURE}', 'org_a', '${gesA}', 'chemical', 'Poeira sem medida'),
      ('${RISK_NOT_ASSESSED}', 'org_a', '${gesA}', 'ergonomic', 'Postura não avaliada'),
      ('${RISK_MODERATE}', 'org_a', '${gesA}', 'accident', 'Queda sem prazo');

    insert into public.risk_assessments
      (org_id, risk_id, criterion, probability, severity, risk_level, result, assessed_at) values
      ('org_a', '${RISK_NO_MEASURE}', 'qualitative', 1, 2, 2, 'trivial', '2024-02-01'),
      ('org_a', '${RISK_MODERATE}', 'qualitative', 3, 4, 12, 'moderate', '2024-02-01');

    insert into public.control_measures
      (id, org_id, risk_id, control_level, applicable, status, action_what, action_how) values
      ('${MEASURE_MODERATE}', 'org_a', '${RISK_MODERATE}', 'collective_protection', true,
       'introduced', 'Guarda-corpo', 'Instalação');
  `);
}

async function consolidatedRisks(): Promise<Map<string, ConsolidatedRisk>> {
  const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
  if (!result.ok) throw new Error(`consolidado falhou: ${result.error.code}`);
  return new Map(result.data.ges.flatMap((g) => g.risks).map((r) => [r.id, r]));
}

async function measureRow(
  admin: ReturnType<typeof postgres>,
  id: string,
): Promise<MeasureRow> {
  const [row] = await admin<MeasureRow[]>`
    select status, applicable, action_responsible, action_deadline::text, updated_at
    from public.control_measures where id = ${id}`;
  return row;
}

(shouldRun ? describe : describe.skip)("Cobertura do plano do PGR (#42)", () => {
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
    await seedCoverage(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("todo risco do inventário aparece com a cobertura derivada — inclusive sem medida", async () => {
    const risks = await consolidatedRisks();
    expect(risks.size).toBe(4);
    expect(risks.get(PGR_IDS.riskA)?.planCoverage).toBe("covered");
    expect(risks.get(RISK_NO_MEASURE)?.planCoverage).toBe("no_measure");
    expect(risks.get(RISK_NO_MEASURE)?.measures).toEqual([]);
    expect(risks.get(RISK_NOT_ASSESSED)?.planCoverage).toBe("not_assessed");
    expect(risks.get(RISK_MODERATE)?.planCoverage).toBe("incomplete");
  });

  it("expõe o status MANTER/INTRODUZIDA/APRIMORADA das medidas no consolidado", async () => {
    const risks = await consolidatedRisks();
    expect(risks.get(PGR_IDS.riskA)?.measures[0].status).toBe("maintain");
    expect(risks.get(RISK_MODERATE)?.measures[0].status).toBe("introduced");
  });

  it("consolidado não cria nenhuma medida nem plano de ação", async () => {
    const [before] = await admin<{ measures: number; plans: number }[]>`
      select (select count(*)::int from public.control_measures where org_id = 'org_a') as measures,
             (select count(*)::int from public.action_plans where org_id = 'org_a') as plans`;
    await consolidatedRisks();
    const [after] = await admin<{ measures: number; plans: number }[]>`
      select (select count(*)::int from public.control_measures where org_id = 'org_a') as measures,
             (select count(*)::int from public.action_plans where org_id = 'org_a') as plans`;
    expect(after).toEqual(before);
  });

  it("tolerável → moderado: risco fica incomplete e a medida não é alterada", async () => {
    const before = await measureRow(admin, PGR_IDS.controlMeasureA);
    await admin.unsafe(`
      insert into public.risk_assessments
        (org_id, risk_id, criterion, probability, severity, risk_level, result, assessed_at)
      values ('org_a', '${PGR_IDS.riskA}', 'qualitative', 3, 4, 12, 'moderate', '2025-01-01')`);

    const risks = await consolidatedRisks();
    expect(risks.get(PGR_IDS.riskA)?.result).toBe("moderate");
    expect(risks.get(PGR_IDS.riskA)?.planCoverage).toBe("incomplete");

    const after = await measureRow(admin, PGR_IDS.controlMeasureA);
    expect(after).toEqual(before);
  });

  it("moderado → tolerável: status, responsável e prazo preservados", async () => {
    await admin.unsafe(`
      update public.control_measures
        set action_responsible = 'SESMT', action_deadline = '2026-12-31'
      where id = '${MEASURE_MODERATE}'`);
    const before = await measureRow(admin, MEASURE_MODERATE);
    await admin.unsafe(`
      insert into public.risk_assessments
        (org_id, risk_id, criterion, probability, severity, risk_level, result, assessed_at)
      values ('org_a', '${RISK_MODERATE}', 'qualitative', 1, 3, 3, 'tolerable', '2025-01-01')`);

    const risks = await consolidatedRisks();
    expect(risks.get(RISK_MODERATE)?.result).toBe("tolerable");
    expect(risks.get(RISK_MODERATE)?.planCoverage).toBe("covered");

    const after = await measureRow(admin, MEASURE_MODERATE);
    expect(after).toEqual(before);
    expect(after.status).toBe("introduced");
    expect(after.action_responsible).toBe("SESMT");
    expect(after.action_deadline).toBe("2026-12-31");
  });

  it("completar responsável e prazo tira o risco de incomplete", async () => {
    await admin.unsafe(`
      update public.control_measures
        set action_responsible = 'Engenharia', action_deadline = '2026-11-30'
      where id = '${MEASURE_MODERATE}'`);
    const risks = await consolidatedRisks();
    expect(risks.get(RISK_MODERATE)?.planCoverage).toBe("covered");
  });

  it("exclusão do risco: sai do plano e as medidas caem em cascata (comportamento atual)", async () => {
    const deleted = await deleteRiskAction(RISK_MODERATE);
    expect(deleted.ok).toBe(true);

    const risks = await consolidatedRisks();
    expect(risks.has(RISK_MODERATE)).toBe(false);
    const [{ total }] = await admin<{ total: number }[]>`
      select count(*)::int as total from public.control_measures where risk_id = ${RISK_MODERATE}`;
    expect(total).toBe(0);
  });

  it("outro escritório não enxerga o plano (NOT_FOUND)", async () => {
    asOwner("org_b");
    const result = await getPgrConsolidatedAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});
