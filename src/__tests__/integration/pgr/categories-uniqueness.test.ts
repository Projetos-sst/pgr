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
  createCategoryAction,
  updateCategoryAction,
} from "@/shared/server/actions/pgr/categories";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

/**
 * US3 — unicidade `(org_id, type, name)`.
 * Seed: org_a tem epi/"Capacete"; org_b tem machine/"Betoneira".
 */
(shouldRun ? describe : describe.skip)(
  "Server Actions — categories uniqueness (US3)",
  () => {
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

    it("nome+tipo duplicado no mesmo escritório → DUPLICATE", async () => {
      const result = await createCategoryAction({ type: "epi", name: "Capacete" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("DUPLICATE");
    });

    it("mesmo nome em tipo diferente no mesmo escritório → ok", async () => {
      const result = await createCategoryAction({ type: "machine", name: "Capacete" });
      expect(result.ok).toBe(true);
    });

    it("mesmo nome+tipo em escritório distinto → ok", async () => {
      asOwner("org_b");
      const result = await createCategoryAction({ type: "epi", name: "Capacete" });
      expect(result.ok).toBe(true);
    });

    it("editar para um (tipo,nome) colidente → DUPLICATE", async () => {
      const created = await createCategoryAction({ type: "machine", name: "Capacete" });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const upd = await updateCategoryAction(created.data.id, {
        type: "epi",
        name: "Capacete",
      });
      expect(upd.ok).toBe(false);
      if (!upd.ok) expect(upd.error.code).toBe("DUPLICATE");
    });
  },
);
