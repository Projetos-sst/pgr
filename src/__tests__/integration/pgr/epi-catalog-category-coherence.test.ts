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
  createEpiCatalogAction,
  updateEpiCatalogAction,
} from "@/shared/server/actions/pgr/epi-catalog";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const { categoryA, categoryB, epiCatalogA } = PGR_IDS;
const ABSENT_UUID = "99999999-9999-9999-9999-999999999999";

(shouldRun ? describe : describe.skip)(
  "Server Actions — epi_catalog coerência Tipo×Categoria (US3)",
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

    it("create: tipo divergente da categoria → FK_NOT_FOUND", async () => {
      // categoryA é epi; item machine apontando para ela é incoerente
      const result = await createEpiCatalogAction({
        type: "machine",
        categoryId: categoryA,
        name: "X",
      });
      expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
    });

    it("create: categoria de outro tenant → FK_NOT_FOUND", async () => {
      const result = await createEpiCatalogAction({
        type: "machine",
        categoryId: categoryB,
        name: "X",
      });
      expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
    });

    it("create: categoryId inexistente → FK_NOT_FOUND", async () => {
      const result = await createEpiCatalogAction({
        type: "epi",
        categoryId: ABSENT_UUID,
        name: "X",
      });
      expect(!result.ok && result.error.code).toBe("FK_NOT_FOUND");
    });

    it("create: categoria compatível do próprio tenant → sucesso", async () => {
      const result = await createEpiCatalogAction({
        type: "epi",
        categoryId: categoryA,
        name: "Protetor auricular",
      });
      expect(result.ok).toBe(true);
    });

    it("update: incoerências também rejeitadas (FK_NOT_FOUND)", async () => {
      const divergent = await updateEpiCatalogAction(epiCatalogA, {
        type: "machine",
        categoryId: categoryA,
        name: "X",
      });
      expect(!divergent.ok && divergent.error.code).toBe("FK_NOT_FOUND");

      const otherTenant = await updateEpiCatalogAction(epiCatalogA, {
        type: "machine",
        categoryId: categoryB,
        name: "X",
      });
      expect(!otherTenant.ok && otherTenant.error.code).toBe("FK_NOT_FOUND");
    });
  },
);
