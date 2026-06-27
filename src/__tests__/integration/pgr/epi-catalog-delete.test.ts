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
  deleteEpiCatalogAction,
  getEpiCatalogAction,
  getEpiCatalogDependentsAction,
} from "@/shared/server/actions/pgr/epi-catalog";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const { categoryA, epiCatalogA } = PGR_IDS;

async function countCatalog(
  admin: ReturnType<typeof postgres>,
  id: string,
): Promise<number> {
  const rows = await admin.unsafe(
    `select count(*)::int as n from public.epi_catalog where id = '${id}'`,
  );
  return (rows[0] as unknown as { n: number }).n;
}

(shouldRun ? describe : describe.skip)(
  "Server Actions — epi_catalog exclusão segura (US4)",
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

    it("sem dependentes → exclui", async () => {
      const created = await createEpiCatalogAction({
        type: "epi",
        categoryId: categoryA,
        name: "Item descartável",
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const del = await deleteEpiCatalogAction(created.data.id);
      expect(del.ok).toBe(true);
      expect(await countCatalog(admin, created.data.id)).toBe(0);
    });

    it("com dependentes (stock+risk+delivery) → IN_USE; item e dependentes preservados (sem cascade)", async () => {
      const dep = await getEpiCatalogDependentsAction(epiCatalogA);
      expect(dep.ok).toBe(true);
      if (dep.ok) {
        expect(dep.data.stock).toBeGreaterThan(0);
        expect(dep.data.risk).toBeGreaterThan(0);
        expect(dep.data.deliveryItems).toBeGreaterThan(0);
      }

      const del = await deleteEpiCatalogAction(epiCatalogA);
      expect(del.ok).toBe(false);
      if (!del.ok) expect(del.error.code).toBe("IN_USE");

      // item preservado
      expect(await countCatalog(admin, epiCatalogA)).toBe(1);
      // ainda recuperável pela action
      const got = await getEpiCatalogAction(epiCatalogA);
      expect(got.ok).toBe(true);
      // dependentes NÃO cascateados
      const stillDep = await getEpiCatalogDependentsAction(epiCatalogA);
      expect(stillDep.ok && stillDep.data.stock).toBeGreaterThan(0);
      expect(stillDep.ok && stillDep.data.risk).toBeGreaterThan(0);
      expect(stillDep.ok && stillDep.data.deliveryItems).toBeGreaterThan(0);
    });

    it("delivery-item only → IN_USE pela pré-checagem (não FK_NOT_FOUND)", async () => {
      // remove stock + risk; mantém apenas o epi_delivery_items (RESTRICT)
      await admin.unsafe(`
      delete from public.epi_stock where catalog_id = '${epiCatalogA}';
      delete from public.epi_risk where catalog_id = '${epiCatalogA}';
    `);

      const dep = await getEpiCatalogDependentsAction(epiCatalogA);
      expect(dep.ok && dep.data.stock).toBe(0);
      expect(dep.ok && dep.data.risk).toBe(0);
      expect(dep.ok && dep.data.deliveryItems).toBeGreaterThan(0);

      const del = await deleteEpiCatalogAction(epiCatalogA);
      expect(del.ok).toBe(false);
      if (!del.ok) expect(del.error.code).toBe("IN_USE");
      expect(await countCatalog(admin, epiCatalogA)).toBe(1);
    });
  },
);
