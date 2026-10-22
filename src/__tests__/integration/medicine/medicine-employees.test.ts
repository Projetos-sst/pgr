/**
 * Integração da lista de funcionários do painel da Medicina
 * (`listMedicineEmployeesAction`) contra Postgres efêmero. Prova: lista de UMA
 * empresa com `latestExam`; busca e paginação no servidor com `total` correto;
 * empresa sem Medicina → FORBIDDEN; empresa de outro tenant → NOT_FOUND;
 * `companyId` ausente/malformado → VALIDATION; nunca devolve funcionário de outra
 * empresa; payload sem CPF/notes/certificatePath.
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
import type { MedicineEmployeesQuery } from "@/shared/domains/medicine/employees";
import { listMedicineEmployeesAction } from "@/shared/server/actions/medicine/overview";

import { adminClient, applyMigrations } from "../_helpers/db";
import {
  FAR_FUTURE,
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

async function list(input: MedicineEmployeesQuery) {
  const result = await listMedicineEmployeesAction(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}

async function errorCode(input: unknown): Promise<string> {
  const result = await listMedicineEmployeesAction(input as MedicineEmployeesQuery);
  expect(result.ok).toBe(false);
  return result.ok ? "OK" : result.error.code;
}

const PAGED = 25;

/** N funcionários fictícios com `created_at` distinto (ordem estável na paginação). */
async function seedPagedEmployees(
  admin: ReturnType<typeof postgres>,
  companyId: string,
  prefix: string,
  count: number,
  cpfBase: number,
): Promise<void> {
  const values = Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    const cpf = String(cpfBase + i).padStart(11, "0");
    return `('org_a','${companyId}','${prefix} ${n}','${cpf}', now() - interval '${i + 10} minutes')`;
  }).join(",\n");
  await admin.unsafe(`
    insert into public.employees (org_id, company_id, full_name, cpf, created_at)
    values ${values};
  `);
}

(shouldRun ? describe : describe.skip)("Medicina — lista de funcionários", () => {
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
    asOwner("org_a");
  });

  it("lista a empresa com o ÚLTIMO exame de cada funcionário (contrato enxuto)", async () => {
    const data = await list({ companyId: I.companyA });
    expect(data.total).toBe(1);
    expect(data.rows).toHaveLength(1);
    const [row] = data.rows;
    expect(Object.keys(row).sort()).toEqual(
      ["fullName", "gesName", "id", "jobRoleTitle", "latestExam", "status"].sort(),
    );
    expect(row).toMatchObject({
      id: I.employeeA,
      fullName: "Func A",
      status: "active",
      jobRoleTitle: "Pedreiro",
      gesName: "GES A",
    });
    // O exame recente (2026), não o antigo vencido (2024).
    expect(row.latestExam).toEqual({
      examType: "periodic",
      performedAt: "2026-01-10",
      validUntil: FAR_FUTURE,
      aptitude: "fit_with_restrictions",
    });
    expectNoSensitiveFields(data);
  });

  it("companyA2 (Medicina ligada, PGR desligado) lista o exame sem validade", async () => {
    const data = await list({ companyId: M.companyA2 });
    expect(data.total).toBe(1);
    expect(data.rows[0].id).toBe(M.employeeA2);
    expect(data.rows[0].latestExam).toMatchObject({
      examType: "admissional",
      validUntil: null,
      aptitude: "fit",
    });
  });

  it("funcionário sem exame → latestExam null", async () => {
    await admin.unsafe(`
      insert into public.employees (org_id, company_id, full_name, cpf)
      values ('org_a','${I.companyA}','EXEMPLO Sem Exame','00000000021');
    `);
    const data = await list({ companyId: I.companyA, search: "Sem Exame" });
    expect(data.total).toBe(1);
    expect(data.rows[0].latestExam).toBeNull();
  });

  it("empate de performed_at → desempate pelo created_at mais recente", async () => {
    await admin.unsafe(`
      insert into public.health_exams (org_id, employee_id, exam_type, performed_at, valid_until, aptitude, created_at) values
        ('org_a','${M.employeeA2}','periodic','2026-05-05','2030-01-01','unfit', now() - interval '1 hour'),
        ('org_a','${M.employeeA2}','return_to_work','2026-05-05','2031-01-01','fit', now());
    `);
    const data = await list({ companyId: M.companyA2 });
    expect(data.rows[0].latestExam).toMatchObject({
      examType: "return_to_work",
      validUntil: "2031-01-01",
    });
  });

  it("busca e paginação no servidor com total correto (sem limite silencioso)", async () => {
    await seedPagedEmployees(admin, I.companyA, "EXEMPLO Paginado", PAGED, 100);
    // Mesmo prefixo em OUTRA empresa do mesmo escritório: não pode entrar na contagem.
    await seedPagedEmployees(admin, M.companyA2, "EXEMPLO Paginado", 3, 200);

    const all = await list({ companyId: I.companyA });
    expect(all.total).toBe(PAGED + 1); // + employeeA
    expect(all.rows).toHaveLength(20); // pageSize padrão

    const seen = new Set<string>();
    for (const page of [1, 2, 3]) {
      const data = await list({
        companyId: I.companyA,
        search: "Paginado",
        page,
        pageSize: 10,
      });
      expect(data.total).toBe(PAGED);
      expect(data.rows).toHaveLength(page === 3 ? 5 : 10);
      for (const row of data.rows) seen.add(row.id);
    }
    expect(seen.size).toBe(PAGED);

    const beyond = await list({
      companyId: I.companyA,
      search: "Paginado",
      page: 4,
      pageSize: 10,
    });
    expect(beyond).toEqual({ total: PAGED, rows: [] });

    const one = await list({ companyId: I.companyA, search: "Paginado 07" });
    expect(one.total).toBe(1);
    expect(one.rows[0].fullName).toBe("EXEMPLO Paginado 07");

    const bySearchOnA2 = await list({ companyId: M.companyA2, search: "Paginado" });
    expect(bySearchOnA2.total).toBe(3);
  });

  it("nunca devolve funcionário de outra empresa (mesmo escritório)", async () => {
    const a = await list({ companyId: I.companyA, pageSize: 100 });
    const a2 = await list({ companyId: M.companyA2, pageSize: 100 });
    const idsA = a.rows.map((r) => r.id);
    const idsA2 = a2.rows.map((r) => r.id);
    expect(idsA).not.toContain(M.employeeA2);
    expect(idsA).not.toContain(M.employeeA3);
    expect(idsA).not.toContain(I.employeeB);
    expect(idsA2).toEqual([M.employeeA2]);
  });

  it("companyA3 (Medicina desligada) → FORBIDDEN (não lista vazia)", async () => {
    expect(await errorCode({ companyId: M.companyA3 })).toBe("FORBIDDEN");
  });

  it("empresa de org_b → NOT_FOUND; UUID inexistente → NOT_FOUND", async () => {
    expect(await errorCode({ companyId: I.companyB })).toBe("NOT_FOUND");
    expect(await errorCode({ companyId: "99999999-9999-9999-9999-999999999999" })).toBe(
      "NOT_FOUND",
    );
  });

  it("companyId ausente/malformado e pageSize > 100 → VALIDATION", async () => {
    expect(await errorCode({})).toBe("VALIDATION");
    expect(await errorCode({ companyId: "" })).toBe("VALIDATION");
    expect(await errorCode({ companyId: "abc" })).toBe("VALIDATION");
    expect(await errorCode({ companyId: I.companyA, pageSize: 101 })).toBe("VALIDATION");
  });

  it("desligar Medicina depois → FORBIDDEN para a mesma empresa", async () => {
    await admin.unsafe(`
      update public.company_modules set enabled = false
      where company_id = '${M.companyA2}' and module = 'medicine';
    `);
    expect(await errorCode({ companyId: M.companyA2 })).toBe("FORBIDDEN");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    expect(await errorCode({ companyId: I.companyA })).toBe("FORBIDDEN");
  });
});
