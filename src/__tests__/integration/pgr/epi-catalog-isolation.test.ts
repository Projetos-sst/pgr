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
  listEpiCatalogAction,
  getEpiCatalogAction,
  updateEpiCatalogAction,
  deleteEpiCatalogAction,
} from "@/shared/server/actions/pgr/epi-catalog";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const { categoryA, epiCatalogB } = PGR_IDS;

(shouldRun ? describe : describe.skip)(
  "Server Actions — epi_catalog isolamento (US2)",
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

    it("cross-tenant: get/update/delete de item de org_b → NOT_FOUND", async () => {
      const got = await getEpiCatalogAction(epiCatalogB);
      expect(!got.ok && got.error.code).toBe("NOT_FOUND");

      // categoria válida de org_a passa no assert; update não encontra a linha (org_b) → NOT_FOUND
      const upd = await updateEpiCatalogAction(epiCatalogB, {
        type: "epi",
        categoryId: categoryA,
        name: "Tentativa",
      });
      expect(!upd.ok && upd.error.code).toBe("NOT_FOUND");

      const del = await deleteEpiCatalogAction(epiCatalogB);
      expect(!del.ok && del.error.code).toBe("NOT_FOUND");
    });

    it("list como org_a não inclui itens de org_b", async () => {
      const list = await listEpiCatalogAction({});
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.data.rows.some((r) => r.id === epiCatalogB)).toBe(false);
      expect(list.data.rows.every((r) => r.orgId === "org_a")).toBe(true);
    });

    it("papel client (gate rejeita) → FORBIDDEN em toda ação", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());
      expect((await listEpiCatalogAction({})).ok).toBe(false);
      const list = await listEpiCatalogAction({});
      expect(!list.ok && list.error.code).toBe("FORBIDDEN");
      const get = await getEpiCatalogAction(epiCatalogB);
      expect(!get.ok && get.error.code).toBe("FORBIDDEN");
    });
  },
);
