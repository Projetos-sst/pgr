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
  listJobRolesAction,
  getJobRoleAction,
  createJobRoleAction,
  deleteJobRoleAction,
} from "@/shared/server/actions/pgr/job-roles";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — job_roles (US3)", () => {
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

  it("lista expõe gesNames (agregado) + employeeCount e status default active", async () => {
    const list = await listJobRolesAction({});
    expect(list.ok).toBe(true);
    if (list.ok) {
      const pedreiro = list.data.rows.find((r) => r.id === PGR_IDS.jobRoleA);
      expect(pedreiro?.gesNames).toBe("GES A"); // seed: jobRoleA ↔ gesA
      expect(pedreiro?.employeeCount).toBe(1); // seed: employeeA
      expect(pedreiro?.isActive).toBe(true);
    }
  });

  it("persiste setor/situação e vincula GES inline (aditivo)", async () => {
    const created = await createJobRoleAction({
      companyId: PGR_IDS.companyA,
      title: "Soldador",
      sector: "Obra Civil",
      isActive: "false",
      gesId: PGR_IDS.gesA,
    });
    expect(created.ok && created.data.sector).toBe("Obra Civil");
    expect(created.ok && created.data.isActive).toBe(false);
    // o vínculo GES aparece no gesNames da listagem
    const list = await listJobRolesAction({ gesId: PGR_IDS.gesA });
    expect(list.ok && list.data.rows.some((r) => r.title === "Soldador")).toBe(true);
  });

  it("filtra por situação (isActive) e por GES", async () => {
    await createJobRoleAction({
      companyId: PGR_IDS.companyA,
      title: "Inativo",
      isActive: "false",
    });
    const inactive = await listJobRolesAction({ isActive: false });
    expect(inactive.ok && inactive.data.rows.every((r) => r.isActive === false)).toBe(
      true,
    );
  });

  it("GES-inline de outro tenant → FK_NOT_FOUND", async () => {
    const result = await createJobRoleAction({
      companyId: PGR_IDS.companyA,
      title: "Com GES inválido",
      gesId: PGR_IDS.gesB,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("título duplicado na mesma empresa → DUPLICATE", async () => {
    const result = await createJobRoleAction({
      companyId: PGR_IDS.companyA,
      title: "Pedreiro",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE");
  });

  it("mesmo título em empresa diferente do tenant é permitido", async () => {
    const created = await createJobRoleAction({
      companyId: PGR_IDS.companyA,
      title: "Eletricista",
    });
    expect(created.ok).toBe(true);
    const list = await listJobRolesAction({ companyId: PGR_IDS.companyA });
    expect(list.ok && list.data.total).toBe(2);
  });

  it("get de outro tenant → NOT_FOUND; delete → NOT_FOUND", async () => {
    expect((await getJobRoleAction(PGR_IDS.jobRoleB)).ok).toBe(false);
    const del = await deleteJobRoleAction(PGR_IDS.jobRoleB);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listJobRolesAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
