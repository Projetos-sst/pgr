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
  listGesAction,
  getGesAction,
  createGesAction,
  deleteGesAction,
  listGesJobRolesAction,
  listAvailableJobRolesAction,
  addGesJobRoleAction,
  updateGesJobRoleAction,
  removeGesJobRoleAction,
} from "@/shared/server/actions/pgr/ges";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — ges + vínculos (US4)", () => {
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

  it("list expõe expostos derivado e totalWorkers do tenant ativo", async () => {
    const result = await listGesAction({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1);
      expect(result.data.totalWorkers).toBe(3);
      expect(result.data.rows[0].exposedWorkers).toBe(3);
    }
  });

  it("get retorna o nº de expostos derivado", async () => {
    const result = await getGesAction(PGR_IDS.gesA);
    expect(result.ok && result.data.exposedWorkers).toBe(3);
  });

  it("create com empresa sem relação à obra (obra de outro tenant) → FK_NOT_FOUND", async () => {
    const result = await createGesAction({
      companyId: PGR_IDS.companyA,
      workUnitId: PGR_IDS.workUnitB,
      name: "GES X",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FK_NOT_FOUND");
  });

  it("add vínculo com worker_count<=0 → VALIDATION", async () => {
    // jobRoleA já está vinculada; usar uma função nova exigiria criá-la — aqui o foco é a validação.
    const result = await addGesJobRoleAction({
      gesId: PGR_IDS.gesA,
      jobRoleId: PGR_IDS.jobRoleA,
      workerCount: "0",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  it("vincular a mesma função duas vezes ao mesmo GES → DUPLICATE", async () => {
    const result = await addGesJobRoleAction({
      gesId: PGR_IDS.gesA,
      jobRoleId: PGR_IDS.jobRoleA,
      workerCount: "2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DUPLICATE");
  });

  it("available exclui funções já vinculadas", async () => {
    const result = await listAvailableJobRolesAction(PGR_IDS.gesA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.some((o) => o.jobRoleId === PGR_IDS.jobRoleA)).toBe(false);
    }
  });

  it("editar/remover vínculo recalcula a soma e o picker reflete", async () => {
    const linked = await listGesJobRolesAction(PGR_IDS.gesA);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    const linkId = linked.data[0].id;

    const updated = await updateGesJobRoleAction(linkId, PGR_IDS.gesA, { workerCount: "5" });
    expect(updated.ok).toBe(true);
    let exposed = await getGesAction(PGR_IDS.gesA);
    expect(exposed.ok && exposed.data.exposedWorkers).toBe(5);

    const removed = await removeGesJobRoleAction(linkId, PGR_IDS.gesA);
    expect(removed.ok).toBe(true);
    exposed = await getGesAction(PGR_IDS.gesA);
    expect(exposed.ok && exposed.data.exposedWorkers).toBe(0);
  });

  it("get/delete de outro tenant → NOT_FOUND", async () => {
    expect((await getGesAction(PGR_IDS.gesB)).ok).toBe(false);
    const del = await deleteGesAction(PGR_IDS.gesB);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listGesAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
