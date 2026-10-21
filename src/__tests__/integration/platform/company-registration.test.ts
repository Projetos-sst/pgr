import type postgres from "postgres";
import { NextRequest } from "next/server";
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import {
  createCompanyAction,
  updateCompanyAction,
} from "@/shared/server/actions/pgr/companies";
import {
  createEmployeeAction,
  updateEmployeeAction,
  getEmployeeAction,
} from "@/shared/server/actions/pgr/employees";
import { POST as COMPANY_POST } from "@/app/api/v1/companies/route";
import { POST as EMPLOYEE_POST } from "@/app/api/v1/employees/route";
import { PUT as COMPANY_PUT } from "@/app/api/v1/companies/[id]/route";
import { PUT as EMPLOYEE_PUT } from "@/app/api/v1/employees/[id]/route";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const enabled =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;
const company = {
  razaoSocial: "Empresa fictícia",
  riskGrade: "2",
  cnpj: "12.ABC.345/01DE-35",
};
const employee = {
  companyId: I.companyA,
  fullName: "Pessoa fictícia",
  cpf: "98765432100",
};
const request = (path: string, body: unknown, tenant = "org_a", role = "owner") =>
  new NextRequest(`http://localhost/api/v1/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dev-tenant": tenant,
      "x-dev-role": role,
    },
  });

(enabled ? describe : describe.skip)("NOB-102 company and employee registration", () => {
  let admin: ReturnType<typeof postgres>;
  const originalEnv = { ...process.env };
  beforeAll(async () => {
    admin = adminClient();
    await admin`set client_min_messages = warning`;
    await applyMigrations(admin);
  });
  afterAll(async () => {
    process.env = originalEnv;
    await admin?.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
    (requireOfficeStaff as jest.Mock).mockResolvedValue({
      userId: "owner",
      tenantId: "org_a",
      role: "owner",
      plan: "free",
    });
  });
  it("normalizes CNPJ and rejects repeated identity on create and update", async () => {
    const created = await createCompanyAction(company);
    expect(created.ok && created.data.cnpj).toBe("12ABC34501DE35");
    const duplicate = await createCompanyAction({ ...company, cnpj: "12abc34501de35" });
    expect(!duplicate.ok && duplicate.error).toMatchObject({
      code: "DUPLICATE",
      fields: { cnpj: expect.any(String) },
    });
    const update = await updateCompanyAction(I.companyA, company);
    expect(!update.ok && update.error.code).toBe("DUPLICATE");
  });
  it("retains the database uniqueness guarantee under concurrent submissions", async () => {
    const results = await Promise.all([
      createCompanyAction(company),
      createCompanyAction(company),
    ]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect(results.filter((x) => !x.ok && x.error.code === "DUPLICATE")).toHaveLength(1);
  });
  it("returns clear validation errors and preserves the optional CNPJ rule", async () => {
    for (const input of [
      { ...company, cnpj: "12ABC34501DE34" },
      { ...company, razaoSocial: "" },
      { ...company, riskGrade: "" },
    ]) {
      const result = await createCompanyAction(input);
      expect(!result.ok && result.error.code).toBe("VALIDATION");
    }
    expect((await createCompanyAction({ ...company, cnpj: "" })).ok).toBe(true);
  });
  it("allows the same normalized CNPJ in another tenant without mixing records", async () => {
    expect((await COMPANY_POST(request("companies", company))).status).toBe(201);
    expect((await COMPANY_POST(request("companies", company, "org_b"))).status).toBe(201);
  });
  it("exercises HTTP validation, conflict and role restrictions", async () => {
    expect(
      (await COMPANY_POST(request("companies", { ...company, cnpj: "!11222333000181" })))
        .status,
    ).toBe(422);
    expect((await COMPANY_POST(request("companies", company))).status).toBe(201);
    const conflict = await COMPANY_POST(
      request("companies", { ...company, cnpj: "12abc34501de35" }),
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.fields.cnpj).toBeDefined();
    expect(
      (await COMPANY_POST(request("companies", company, "org_a", "client"))).status,
    ).toBe(403);
  });
  it("returns validation errors for malformed JSON on both create and edit", async () => {
    const invalid = (method: string) =>
      new NextRequest("http://localhost/api/v1/companies", {
        method,
        body: "{",
        headers: { "x-dev-tenant": "org_a", "x-dev-role": "owner" },
      });
    expect((await COMPANY_POST(invalid("POST"))).status).toBe(422);
    expect((await EMPLOYEE_POST(invalid("POST"))).status).toBe(422);
    expect(
      (await COMPANY_PUT(invalid("PUT"), { params: Promise.resolve({ id: I.companyA }) }))
        .status,
    ).toBe(422);
    expect(
      (
        await EMPLOYEE_PUT(invalid("PUT"), {
          params: Promise.resolve({ id: I.employeeA }),
        })
      ).status,
    ).toBe(422);
  });
  it("persists employee identity in the selected company with valid GES and role", async () => {
    const created = await createEmployeeAction({
      ...employee,
      gesId: I.gesA,
      jobRoleId: I.jobRoleA,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const saved = await getEmployeeAction(created.data.id);
    expect(saved.ok && saved.data).toMatchObject({
      companyId: I.companyA,
      gesId: I.gesA,
      jobRoleId: I.jobRoleA,
    });
  });
  it("rejects foreign references and leaves the original employee intact", async () => {
    for (const input of [
      { ...employee, companyId: I.companyB },
      { ...employee, gesId: I.gesB },
      { ...employee, gesId: I.gesA, jobRoleId: I.jobRoleB },
    ]) {
      const result = await updateEmployeeAction(I.employeeA, input);
      expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
      expect((await EMPLOYEE_POST(request("employees", input))).status).toBe(422);
    }
    const row = await admin`select company_id from employees where id = ${I.employeeA}`;
    expect(row[0].company_id).toBe(I.companyA);
  });
  it("rejects a GES from another company even inside the same tenant", async () => {
    const [other] =
      await admin`insert into companies (org_id, razao_social) values ('org_a', 'Outra empresa fictícia') returning id`;
    const result = await createEmployeeAction({
      ...employee,
      companyId: other.id,
      gesId: I.gesA,
    });
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });
  it("validates employee required fields and duplicate CPF within the existing tenant rule", async () => {
    const duplicate = await createEmployeeAction({ ...employee, cpf: "12345678901" });
    expect(!duplicate.ok && duplicate.error.code).toBe("DUPLICATE");
    expect(
      (await EMPLOYEE_POST(request("employees", { ...employee, fullName: "" }))).status,
    ).toBe(422);
    expect(
      (await EMPLOYEE_POST(request("employees", { ...employee, companyId: "" }))).status,
    ).toBe(422);
  });
});
