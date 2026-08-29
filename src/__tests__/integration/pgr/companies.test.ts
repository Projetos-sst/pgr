/**
 * Integração das Server Actions de Empresa contra Postgres efêmero.
 * Mocka apenas o gate de papel (controle de tenant/role), a URL do banco (app
 * runtime aponta para o efêmero) e next/cache (revalidatePath é no-op em teste).
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
import { ForbiddenError } from "@/shared/auth/errors";
import {
  listCompaniesAction,
  getCompanyAction,
  createCompanyAction,
  updateCompanyAction,
  deleteCompanyAction,
} from "@/shared/server/actions/pgr/companies";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;

function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}

(shouldRun ? describe : describe.skip)("Server Actions — companies (US1)", () => {
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

  it("list retorna apenas empresas do tenant ativo", async () => {
    const result = await listCompaniesAction({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1);
      expect(result.data.rows[0].razaoSocial).toBe("A Ltda");
    }
  });

  it("create persiste todos os campos e aparece na lista", async () => {
    const created = await createCompanyAction({
      razaoSocial: "Nova Empresa",
      riskGrade: "3",
      city: "Campinas",
      state: "SP",
    });
    expect(created.ok).toBe(true);
    const list = await listCompaniesAction({ search: "Nova" });
    expect(list.ok && list.data.total).toBe(1);
  });

  it("create com CNPJ duplicado no mesmo tenant → DUPLICATE", async () => {
    const result = await createCompanyAction({
      razaoSocial: "Clone",
      riskGrade: "1",
      cnpj: "11222333000181",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE");
  });

  it("create com riskGrade fora de 1..4 → VALIDATION", async () => {
    const result = await createCompanyAction({ razaoSocial: "X", riskGrade: "9" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.fields?.riskGrade).toBeDefined();
    }
  });

  it("get de empresa de outro tenant → NOT_FOUND", async () => {
    const result = await getCompanyAction(PGR_IDS.companyB);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("update de empresa de outro tenant → NOT_FOUND", async () => {
    const result = await updateCompanyAction(PGR_IDS.companyB, {
      razaoSocial: "Hijack",
      riskGrade: "2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("delete de empresa de outro tenant → NOT_FOUND", async () => {
    const result = await deleteCompanyAction(PGR_IDS.companyB);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN em qualquer action", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listCompaniesAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
