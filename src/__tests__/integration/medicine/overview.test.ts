/**
 * Integração do painel da Medicina (`getMedicineOverviewAction`) contra Postgres
 * efêmero. Prova: só empresas do tenant COM Medicina; contagem pela situação do
 * ÚLTIMO exame de cada funcionário; `withoutExam`; desligar Medicina remove a
 * empresa; `client` → FORBIDDEN; nenhum campo sensível no payload.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { ForbiddenError } from "@/shared/auth/errors";
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { todayInSaoPaulo } from "@/shared/dates";
import { getMedicineOverviewAction } from "@/shared/server/actions/medicine/overview";

import { adminClient, applyMigrations } from "../_helpers/db";
import {
  MEDICINE_IDS as M,
  expectNoSensitiveFields,
  saoPauloDatePlus,
  seedMedicine,
} from "../_helpers/medicine-seed";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asRole = (tenantId: string, role: "owner" | "collaborator" = "owner") =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role });

async function overview() {
  const result = await getMedicineOverviewAction();
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}

(shouldRun ? describe : describe.skip)("Medicina — painel (overview)", () => {
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
    await seedMedicine(admin);
    mockedGate.mockReset();
    asRole("org_a");
  });

  it("lista companyA e companyA2; nunca companyA3 (sem Medicina) nem org_b", async () => {
    const data = await overview();
    const ids = data.companies.map((c) => c.companyId);
    expect(ids).toEqual([I.companyA, M.companyA2]); // ordenadas por razão social
    expect(ids).not.toContain(M.companyA3);
    expect(ids).not.toContain(I.companyB);
    expect(data.totals.companies).toBe(2);
    expect(data.dueWindowDays).toBe(30);
    expect(data.today).toBe(todayInSaoPaulo());
  });

  it("conta pela situação do ÚLTIMO exame (exame antigo vencido não conta)", async () => {
    const data = await overview();
    const a = data.companies.find((c) => c.companyId === I.companyA)!;
    const a2 = data.companies.find((c) => c.companyId === M.companyA2)!;

    // employeeA: antigo vencido (2025) + recente vigente → conta só como `ok`.
    expect(a).toMatchObject({
      companyName: "A Ltda",
      employeeCount: 1,
      validity: { ok: 1, dueSoon: 0, expired: 0, noExpiry: 0, withoutExam: 0 },
    });
    // employeeA2: exame sem validade informada → `noExpiry`.
    expect(a2).toMatchObject({
      companyName: "EXEMPLO Empresa A2",
      employeeCount: 1,
      validity: { ok: 0, dueSoon: 0, expired: 0, noExpiry: 1, withoutExam: 0 },
    });
    expect(data.totals).toEqual({
      companies: 2,
      employees: 2,
      ok: 1,
      dueSoon: 0,
      expired: 0,
      noExpiry: 1,
      withoutExam: 0,
    });
  });

  it("último exame é o de performed_at mais recente, mesmo vencido", async () => {
    // Exame mais novo de employeeA, já vencido → agora ele é o último.
    await admin.unsafe(`
      insert into public.health_exams (org_id, employee_id, exam_type, performed_at, valid_until, aptitude)
      values ('org_a','${I.employeeA}','periodic','2026-02-01','2026-03-01','fit');
    `);
    const data = await overview();
    const a = data.companies.find((c) => c.companyId === I.companyA)!;
    expect(a.validity).toEqual({
      ok: 0,
      dueSoon: 0,
      expired: 1,
      noExpiry: 0,
      withoutExam: 0,
    });
  });

  it("a vencer dentro da janela de 30 dias → dueSoon", async () => {
    const soon = saoPauloDatePlus(10, todayInSaoPaulo());
    await admin.unsafe(`
      insert into public.health_exams (org_id, employee_id, exam_type, performed_at, valid_until, aptitude)
      values ('org_a','${M.employeeA2}','periodic','2026-06-01','${soon}','fit');
    `);
    const data = await overview();
    const a2 = data.companies.find((c) => c.companyId === M.companyA2)!;
    expect(a2.validity).toMatchObject({ dueSoon: 1, noExpiry: 0 });
  });

  it("funcionário sem exame entra em withoutExam (todos os status)", async () => {
    await admin.unsafe(`
      insert into public.employees (org_id, company_id, full_name, cpf, status) values
        ('org_a','${I.companyA}','EXEMPLO Sem Exame 1','00000000011','active'),
        ('org_a','${I.companyA}','EXEMPLO Sem Exame 2','00000000012','dismissed');
    `);
    const data = await overview();
    const a = data.companies.find((c) => c.companyId === I.companyA)!;
    expect(a.employeeCount).toBe(3);
    expect(a.validity.withoutExam).toBe(2);
    expect(data.totals.withoutExam).toBe(2);
    expect(data.totals.employees).toBe(4);
  });

  it("funcionários de companyA3 (sem Medicina) não entram nas contagens", async () => {
    await admin.unsafe(`
      insert into public.employees (org_id, company_id, full_name, cpf) values
        ('org_a','${M.companyA3}','EXEMPLO Extra A3','00000000013');
    `);
    const data = await overview();
    expect(data.totals.employees).toBe(2);
  });

  it("desligar Medicina em companyA2 (admin) remove a empresa do painel", async () => {
    await admin.unsafe(`
      update public.company_modules set enabled = false
      where company_id = '${M.companyA2}' and module = 'medicine';
    `);
    const data = await overview();
    expect(data.companies.map((c) => c.companyId)).toEqual([I.companyA]);
    expect(data.totals).toMatchObject({ companies: 1, employees: 1, noExpiry: 0 });
  });

  it("escritório sem nenhuma empresa com Medicina → vazio com zeros (não erro)", async () => {
    await admin.unsafe(`
      update public.company_modules set enabled = false
      where org_id = 'org_a' and module = 'medicine';
    `);
    const data = await overview();
    expect(data.companies).toEqual([]);
    expect(data.totals).toEqual({
      companies: 0,
      employees: 0,
      ok: 0,
      dueSoon: 0,
      expired: 0,
      noExpiry: 0,
      withoutExam: 0,
    });
  });

  it("org_b vê só companyB (tenant da sessão)", async () => {
    asRole("org_b", "collaborator");
    const data = await overview();
    expect(data.companies.map((c) => c.companyId)).toEqual([I.companyB]);
    expect(data.totals).toMatchObject({ employees: 1, ok: 1 });
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await getMedicineOverviewAction();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("payload sem notes/certificatePath/cpf", async () => {
    expectNoSensitiveFields(await overview());
  });
});
