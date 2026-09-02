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
  createTrainingRecordAction,
  getTrainingDueSummaryAction,
  listTrainingExpiryAction,
} from "@/shared/server/actions/pgr/training-records";
import { todayInSaoPaulo } from "@/shared/dates";

import { adminClient, applyMigrations } from "./_helpers/db";
import { seedPgrBase, PGR_IDS } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const CATALOG = {
  annualA: "51111111-1111-1111-1111-1111111111a1",
  biennialA: "51111111-1111-1111-1111-1111111111a2",
  singleA: "51111111-1111-1111-1111-1111111111a3",
  annualB: "52222222-2222-2222-2222-2222222222b1",
} as const;

const I = PGR_IDS;

function shiftDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function shiftYears(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year + years, month - 1, day)).toISOString().slice(0, 10);
}

async function seedTrainingCatalog(admin: ReturnType<typeof postgres>): Promise<void> {
  await admin.unsafe(`
    insert into public.training_catalog (id, org_id, number, name, workload_hours, periodicity) values
      ('${CATALOG.annualA}','org_a',1,'NR-18 Canteiro',4,'annual'),
      ('${CATALOG.biennialA}','org_a',2,'NR-35 Altura',8,'biennial'),
      ('${CATALOG.singleA}','org_a',3,'Integração',2,'single'),
      ('${CATALOG.annualB}','org_b',1,'NR-10 SEP',40,'annual');
  `);
}

(shouldRun ? describe : describe.skip)("US3 — controle de vencimento/reciclagem", () => {
  let admin: ReturnType<typeof postgres>;
  const today = todayInSaoPaulo();

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    await seedTrainingCatalog(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("classifica vencido / a vencer / em dia e exclui single do cômputo", async () => {
    // annual realizado há +1 ano e 10 dias → venceu há 10 dias (expired)
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.annualA,
      completedAt: shiftDays(shiftYears(today, -1), -10),
    });
    // biennial realizado há 2 anos - 10 dias → vence em ~10 dias (due_soon na janela 30)
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.biennialA,
      completedAt: shiftDays(shiftYears(today, -2), 10),
    });
    // single realizado → fora do cômputo de vencimento
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.singleA,
      completedAt: today,
    });

    const result = await listTrainingExpiryAction({ dueWithinDays: 30 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(2); // single fora
    const byTraining = Object.fromEntries(
      result.data.map((row) => [row.trainingId, row.status]),
    );
    expect(byTraining[CATALOG.annualA]).toBe("expired");
    expect(byTraining[CATALOG.biennialA]).toBe("due_soon");
    expect(byTraining[CATALOG.singleA]).toBeUndefined();
  });

  it("janela 30 vs 90 muda a classificação de quem vence em ~45 dias", async () => {
    // annual realizado há 1 ano - 45 dias → vence em ~45 dias
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.annualA,
      completedAt: shiftDays(shiftYears(today, -1), 45),
    });

    const narrow = await listTrainingExpiryAction({ dueWithinDays: 30 });
    expect(narrow.ok && narrow.data[0].status).toBe("ok");

    const wide = await listTrainingExpiryAction({ dueWithinDays: 90 });
    expect(wide.ok && wide.data[0].status).toBe("due_soon");
  });

  it("reciclagem: só o ÚLTIMO registro conta (D5) — nova realização tira o vencido", async () => {
    // realização antiga (vencida)
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.annualA,
      completedAt: shiftYears(today, -2),
    });
    const before = await listTrainingExpiryAction({ dueWithinDays: 30 });
    expect(before.ok && before.data[0].status).toBe("expired");

    // reciclagem hoje → válida por 1 ano
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.annualA,
      completedAt: today,
    });
    const after = await listTrainingExpiryAction({ dueWithinDays: 30 });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data).toHaveLength(1); // um par (funcionário, treinamento)
    expect(after.data[0].status).toBe("ok");
    expect(after.data[0].validUntil).toBe(shiftYears(today, 1));
  });

  it("filtro por funcionário restringe as linhas", async () => {
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.annualA,
      completedAt: today,
    });

    const forEmployee = await listTrainingExpiryAction({
      employeeId: I.employeeA,
      dueWithinDays: 30,
    });
    expect(forEmployee.ok && forEmployee.data).toHaveLength(1);

    const forOther = await listTrainingExpiryAction({
      employeeId: I.employeeB,
      dueWithinDays: 30,
    });
    expect(forOther.ok && forOther.data).toHaveLength(0);
  });

  it("resumo {expired, dueSoon} conta só o tenant ativo", async () => {
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.annualA,
      completedAt: shiftYears(today, -2), // expired
    });
    await createTrainingRecordAction({
      employeeId: I.employeeA,
      trainingId: CATALOG.biennialA,
      completedAt: shiftDays(shiftYears(today, -2), 10), // due_soon
    });
    // registro vencido do tenant B não pode contaminar o resumo de A
    await admin.unsafe(`
      insert into public.training_records (org_id, employee_id, training_id, completed_at, valid_until)
      values ('org_b','${I.employeeB}','${CATALOG.annualB}','2020-01-01','2021-01-01');
    `);

    const summary = await getTrainingDueSummaryAction();
    expect(summary.ok && summary.data).toEqual({ expired: 1, dueSoon: 1 });
  });

  it("isolamento: tenant A não enxerga vencidos do tenant B", async () => {
    await admin.unsafe(`
      insert into public.training_records (org_id, employee_id, training_id, completed_at, valid_until)
      values ('org_b','${I.employeeB}','${CATALOG.annualB}','2020-01-01','2021-01-01');
    `);

    const result = await listTrainingExpiryAction({ dueWithinDays: 30 });
    expect(result.ok && result.data).toHaveLength(0);
  });

  it("nenhum vencimento → lista vazia (estado vazio positivo), resumo zerado", async () => {
    const result = await listTrainingExpiryAction({ dueWithinDays: 30 });
    expect(result.ok && result.data).toHaveLength(0);

    const summary = await getTrainingDueSummaryAction();
    expect(summary.ok && summary.data).toEqual({ expired: 0, dueSoon: 0 });
  });
});
