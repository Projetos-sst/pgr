/**
 * Integração dos filtros `employeeId`/`companyId` de `listHealthExamsAction` e da
 * checagem de módulo na escrita, contra Postgres efêmero. Prova: filtros somados a
 * `org_id` (outro tenant → lista vazia, nunca vazamento); `companyId` não vaza entre
 * empresas do mesmo escritório; ID malformado → VALIDATION (não lista vazia);
 * exame de empresa sem Medicina é invisível e não pode ser criado (FORBIDDEN).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { revalidatePath } from "next/cache";

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  createHealthExamAction,
  listHealthExamsAction,
  updateHealthExamAction,
} from "@/shared/server/actions/pgr/health-exams";

import { adminClient, applyMigrations } from "../_helpers/db";
import {
  MEDICINE_IDS as M,
  expectNoSensitiveFields,
  seedMedicine,
} from "../_helpers/medicine-seed";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

type ListParams = Parameters<typeof listHealthExamsAction>[0];

async function list(params: ListParams) {
  const result = await listHealthExamsAction(params);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}

(shouldRun ? describe : describe.skip)("Medicina — filtros de exames e módulo", () => {
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
    (revalidatePath as jest.Mock).mockClear();
    asOwner("org_a");
  });

  it("sem filtro: só exames visíveis do tenant (companyA3 sem Medicina fica oculta)", async () => {
    const data = await list({});
    expect(data.total).toBe(3);
    const ids = data.rows.map((r) => r.id).sort();
    expect(ids).toEqual([M.examAOld, M.examARecent, M.examA2].sort());
    expect(ids).not.toContain(M.examA3);
    expect(ids).not.toContain(M.examB);
    expectNoSensitiveFields(data);
  });

  it("employeeId filtra por funcionário (mais recente primeiro)", async () => {
    const a = await list({ employeeId: I.employeeA });
    expect(a.total).toBe(2);
    expect(a.rows.map((r) => r.id)).toEqual([M.examARecent, M.examAOld]);
    expect(a.rows.every((r) => r.employeeId === I.employeeA)).toBe(true);

    const a2 = await list({ employeeId: M.employeeA2 });
    expect(a2.total).toBe(1);
    expect(a2.rows[0].id).toBe(M.examA2);
  });

  it("companyId de companyA não traz exames de companyA2 (mesmo escritório)", async () => {
    const a = await list({ companyId: I.companyA });
    expect(a.total).toBe(2);
    expect(a.rows.map((r) => r.employeeId)).toEqual([I.employeeA, I.employeeA]);
    expect(a.rows.map((r) => r.id)).not.toContain(M.examA2);

    const a2 = await list({ companyId: M.companyA2 });
    expect(a2.total).toBe(1);
    expect(a2.rows[0].id).toBe(M.examA2);
  });

  it("filtros combinam com busca/tipo/paginação com total correto", async () => {
    const page = await list({ companyId: I.companyA, page: 2, pageSize: 1 });
    expect(page.total).toBe(2);
    expect(page.rows.map((r) => r.id)).toEqual([M.examAOld]);

    const byType = await list({ companyId: I.companyA, examType: "admissional" });
    expect(byType.total).toBe(1);
    expect(byType.rows[0].id).toBe(M.examAOld);

    const mismatch = await list({ employeeId: I.employeeA, companyId: M.companyA2 });
    expect(mismatch).toEqual({ total: 0, rows: [] });
  });

  it("employeeId/companyId de org_b → ok com lista vazia (nunca vazamento)", async () => {
    expect(await list({ employeeId: I.employeeB })).toEqual({ total: 0, rows: [] });
    expect(await list({ companyId: I.companyB })).toEqual({ total: 0, rows: [] });
  });

  it("employeeId/companyId de empresa sem Medicina → ok com lista vazia", async () => {
    expect(await list({ employeeId: M.employeeA3 })).toEqual({ total: 0, rows: [] });
    expect(await list({ companyId: M.companyA3 })).toEqual({ total: 0, rows: [] });
  });

  it("desligar Medicina em companyA2 (admin) oculta os exames dela sem apagá-los", async () => {
    await admin.unsafe(`
      update public.company_modules set enabled = false
      where company_id = '${M.companyA2}' and module = 'medicine';
    `);
    expect(await list({ employeeId: M.employeeA2 })).toEqual({ total: 0, rows: [] });
    expect((await list({})).total).toBe(2);
    const [{ count }] = await admin<{ count: number }[]>`
      select count(*)::int as count from public.health_exams where employee_id = ${M.employeeA2}`;
    expect(count).toBe(1);
  });

  it("ID malformado → VALIDATION (não lista vazia)", async () => {
    for (const params of [
      { employeeId: "abc" },
      { companyId: "invalido" },
      { employeeId: `${I.employeeA}0` },
    ]) {
      const result = await listHealthExamsAction(params);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    }
  });

  it("criar exame para funcionário de companyA3 (sem Medicina) → FORBIDDEN", async () => {
    const result = await createHealthExamAction({
      employeeId: M.employeeA3,
      examType: "periodic",
      performedAt: "2026-04-01",
      aptitude: "fit",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    const [{ count }] = await admin<{ count: number }[]>`
      select count(*)::int as count from public.health_exams where employee_id = ${M.employeeA3}`;
    expect(count).toBe(1); // só o exame semeado como admin
  });

  it("mover exame para funcionário de companyA3 via update → recusado (Lote 02A: troca de funcionário → VALIDATION)", async () => {
    const result = await updateHealthExamAction(M.examA2, {
      employeeId: M.employeeA3,
      examType: "admissional",
      performedAt: "2026-02-10",
      aptitude: "fit",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    const [row] =
      await admin`select employee_id from health_exams where id = ${M.examA2}`;
    expect(row.employee_id).toBe(M.employeeA2);
  });

  it("criar exame em companyA2 (Medicina ligada, PGR desligado) → ok e revalida ficha/painel", async () => {
    const result = await createHealthExamAction({
      employeeId: M.employeeA2,
      doctorId: M.doctorA1,
      examType: "periodic",
      performedAt: "2026-04-01",
      validUntil: "2027-04-01",
      aptitude: "fit",
    });
    expect(result.ok).toBe(true);
    const paths = (revalidatePath as jest.Mock).mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/health-exams",
        "/medicine",
        `/employees/${M.employeeA2}`,
      ]),
    );
    const after = await list({ employeeId: M.employeeA2 });
    expect(after.total).toBe(2);
    expect(after.rows[0].doctorName).toBe("EXEMPLO Dra. Médica 1");
  });
});
