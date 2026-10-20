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
  listCompanyOptionsAction,
  listCompaniesAction,
  updateCompanyAction,
} from "@/shared/server/actions/pgr/companies";
import {
  listEmployeesAction,
  updateEmployeeAction,
} from "@/shared/server/actions/pgr/employees";
import {
  createHealthExamAction,
  listHealthExamsAction,
} from "@/shared/server/actions/pgr/health-exams";
import { listPgrAction } from "@/shared/server/actions/pgr/pgr";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
(enabled ? describe : describe.skip)("shared identities between PGR and Medicine", () => {
  let admin: ReturnType<typeof postgres>;
  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });
  afterAll(async () => {
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    (requireOfficeStaff as jest.Mock).mockResolvedValue({
      userId: "staff",
      tenantId: "org_a",
      role: "owner",
      plan: "free",
    });
  });
  it("reflects common edits without cloning companies or employees", async () => {
    expect(
      (
        await createHealthExamAction({
          employeeId: I.employeeA,
          examType: "admissional",
          performedAt: "2026-01-01",
          aptitude: "fit",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await updateCompanyAction(I.companyA, {
          razaoSocial: "Empresa atualizada",
          riskGrade: "2",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await updateEmployeeAction(I.employeeA, {
          companyId: I.companyA,
          fullName: "Nome atualizado",
          cpf: "12345678901",
        })
      ).ok,
    ).toBe(true);
    const [companies, employees, pgrs, exams] = await Promise.all([
      listCompaniesAction(),
      listEmployeesAction(),
      listPgrAction(),
      listHealthExamsAction(),
    ]);
    expect(companies.ok && companies.data.total).toBe(1);
    expect(employees.ok && employees.data.total).toBe(1);
    expect(companies.ok && companies.data.rows[0].id).toBe(I.companyA);
    expect(employees.ok && employees.data.rows[0].id).toBe(I.employeeA);
    expect(pgrs.ok && pgrs.data.rows[0].companyName).toBe("Empresa atualizada");
    expect(exams.ok && exams.data.rows[0].employeeId).toBe(I.employeeA);
    expect(exams.ok && exams.data.rows[0].employeeName).toBe("Nome atualizado");
  });
  it("keeps shared records available to Medicine without requiring PGR", async () => {
    await admin`update company_modules set enabled = false where company_id = ${I.companyA} and module = 'pgr'`;
    const [pgr, medicine, common, employees] = await Promise.all([
      listCompanyOptionsAction("pgr"),
      listCompanyOptionsAction("medicine"),
      listCompanyOptionsAction(),
      listEmployeesAction({ module: "medicine" }),
    ]);
    expect(pgr.ok && pgr.data.length).toBe(0);
    expect(medicine.ok && medicine.data.map((row) => row.id)).toEqual([I.companyA]);
    expect(common.ok && common.data.length).toBe(1);
    expect(employees.ok && employees.data.rows[0].id).toBe(I.employeeA);
  });
  it("does not return another tenant's records or accept unknown modules", async () => {
    const result = await listEmployeesAction({
      companyId: I.companyB,
      module: "medicine",
    });
    expect(result.ok && result.data.total).toBe(0);
    const invalid = await listEmployeesAction({ module: "other" as "medicine" });
    expect(!invalid.ok && invalid.error.code).toBe("VALIDATION");
  });
});
