/**
 * Integração das Server Actions de vínculo PGR↔GES contra Postgres efêmero.
 * Mocka o gate de papel, a URL do banco (app runtime → efêmero) e next/cache.
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
  listPgrGesAction,
  addGesToPgrAction,
  removeGesFromPgrAction,
} from "@/shared/server/actions/pgr/pgr-ges";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
function asOwner(tenantId: string) {
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });
}
const RANDOM_UUID = "99999999-9999-9999-9999-999999999999";

(shouldRun ? describe : describe.skip)("Server Actions — pgr_ges", () => {
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

  it("list retorna os GES vinculados ao PGR (seed = 1: gesA)", async () => {
    const result = await listPgrGesAction(PGR_IDS.pgrA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].gesId).toBe(PGR_IDS.gesA);
    }
  });

  it("add de GES já vinculado → DUPLICATE (UNIQUE)", async () => {
    const result = await addGesToPgrAction(PGR_IDS.pgrA, { gesId: PGR_IDS.gesA });
    expect(!result.ok && result.error.code).toBe("DUPLICATE");
  });

  it("add de GES de outro tenant → FK_NOT_FOUND", async () => {
    const result = await addGesToPgrAction(PGR_IDS.pgrA, { gesId: PGR_IDS.gesB });
    expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
  });

  it("remove o vínculo e re-adiciona (libera o par)", async () => {
    const del = await removeGesFromPgrAction(PGR_IDS.pgrA, PGR_IDS.gesA);
    expect(del.ok).toBe(true);
    const after = await listPgrGesAction(PGR_IDS.pgrA);
    expect(after.ok && after.data).toHaveLength(0);
    const readd = await addGesToPgrAction(PGR_IDS.pgrA, { gesId: PGR_IDS.gesA });
    expect(readd.ok).toBe(true);
  });

  it("remove de vínculo inexistente → NOT_FOUND", async () => {
    const del = await removeGesFromPgrAction(PGR_IDS.pgrA, RANDOM_UUID);
    expect(!del.ok && del.error.code).toBe("NOT_FOUND");
  });

  it("PGR inexistente/cross-tenant → NOT_FOUND (list/add)", async () => {
    const list = await listPgrGesAction(PGR_IDS.pgrB); // pgrB é de org_b
    expect(!list.ok && list.error.code).toBe("NOT_FOUND");
    const add = await addGesToPgrAction(PGR_IDS.pgrB, { gesId: PGR_IDS.gesA });
    expect(!add.ok && add.error.code).toBe("NOT_FOUND");
  });

  it("gesId inválido (não-UUID) → VALIDATION", async () => {
    const result = await addGesToPgrAction(PGR_IDS.pgrA, { gesId: "abc" });
    expect(!result.ok && result.error.code).toBe("VALIDATION");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockReset();
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listPgrGesAction(PGR_IDS.pgrA);
    expect(!result.ok && result.error.code).toBe("FORBIDDEN");
  });
});
