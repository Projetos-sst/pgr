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
  listCategoriesAction,
  getCategoryAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/shared/server/actions/pgr/categories";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Server Actions — categories CRUD (US1)", () => {
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

  it("cria, lista, detalha, edita e exclui (escopado ao tenant)", async () => {
    const created = await createCategoryAction({ type: "epi", name: "Luva" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // seed já tem 1 categoria de org_a ("Capacete") → agora 2
    const list = await listCategoriesAction({});
    expect(list.ok && list.data.total).toBe(2);

    const got = await getCategoryAction(created.data.id);
    expect(got.ok && got.data.name).toBe("Luva");

    const updated = await updateCategoryAction(created.data.id, {
      type: "epi",
      name: "Luva nitrílica",
    });
    expect(updated.ok && updated.data.name).toBe("Luva nitrílica");

    const del = await deleteCategoryAction(created.data.id);
    expect(del.ok).toBe(true);

    const after = await listCategoriesAction({});
    expect(after.ok && after.data.total).toBe(1);
  });

  it("filtra por tipo e busca por nome", async () => {
    await createCategoryAction({ type: "machine", name: "Serra circular" });

    const epiOnly = await listCategoriesAction({ type: "epi" });
    expect(epiOnly.ok && epiOnly.data.rows.every((r) => r.type === "epi")).toBe(true);

    const byName = await listCategoriesAction({ search: "Serra" });
    expect(byName.ok && byName.data.total).toBe(1);
  });

  it("tipo inválido → VALIDATION", async () => {
    const result = await createCategoryAction({ type: "ppe" as never, name: "X" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });

  it("nome vazio → VALIDATION", async () => {
    const result = await createCategoryAction({ type: "epi", name: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });
});
