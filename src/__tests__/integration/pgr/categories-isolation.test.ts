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
  listCategoriesAction,
  getCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/shared/server/actions/pgr/categories";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

/**
 * US2 — isolamento de `categories`.
 *
 * Nível de Server Action (este arquivo): cross-tenant por id → NOT_FOUND;
 * list não vaza o outro escritório; papel `client` → FORBIDDEN.
 *
 * Nível de tabela/RLS — incluindo o cenário SEM TENANT FIXADO (sem `app.current_org`
 * → 0 linhas, jamais todas), tenant inexistente → 0 linhas, e bare query após withOrg
 * que não vaza o escopo — é coberto formalmente por
 * `src/__tests__/integration/shared/db/categories-isolation.test.ts` (runIsolationSuite).
 * Não duplicar esse teste aqui (spec US2 cenário 4 / FR-021 / Inv-2).
 */
(shouldRun ? describe : describe.skip)(
  "Server Actions — categories isolation (US2)",
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

    it("get/update/delete de categoria de outro escritório → NOT_FOUND", async () => {
      const got = await getCategoryAction(PGR_IDS.categoryB);
      expect(got.ok).toBe(false);
      if (!got.ok) expect(got.error.code).toBe("NOT_FOUND");

      const upd = await updateCategoryAction(PGR_IDS.categoryB, {
        type: "machine",
        name: "Hijack",
      });
      expect(upd.ok).toBe(false);
      if (!upd.ok) expect(upd.error.code).toBe("NOT_FOUND");

      const del = await deleteCategoryAction(PGR_IDS.categoryB);
      expect(del.ok).toBe(false);
      if (!del.ok) expect(del.error.code).toBe("NOT_FOUND");
    });

    it("list como org_a não inclui categorias de org_b", async () => {
      const list = await listCategoriesAction({});
      expect(list.ok).toBe(true);
      if (list.ok) {
        expect(list.data.total).toBe(1);
        expect(list.data.rows.every((r) => r.id !== PGR_IDS.categoryB)).toBe(true);
      }
    });

    it("papel client → FORBIDDEN em qualquer operação", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());
      const result = await listCategoriesAction({});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });
  },
);
