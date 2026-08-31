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
  listEpiCatalogAction,
  getEpiCatalogAction,
  createEpiCatalogAction,
  updateEpiCatalogAction,
  deleteEpiCatalogAction,
  listEpiCatalogAuditAction,
} from "@/shared/server/actions/pgr/epi-catalog";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

const { categoryA } = PGR_IDS;

(shouldRun ? describe : describe.skip)("Server Actions — epi_catalog CRUD (US1)", () => {
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

  it("cria, lista (com categoryName), detalha, edita e exclui (escopado ao tenant)", async () => {
    const created = await createEpiCatalogAction({
      type: "epi",
      categoryId: categoryA,
      name: "Luva nitrílica",
      ca: "55555",
      caValidUntil: "2027-01-31",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // seed já tem 1 item de org_a ("Capacete CA-123") → agora 2
    const list = await listEpiCatalogAction({});
    expect(list.ok && list.data.total).toBe(2);
    expect(
      list.ok && list.data.rows.every((r) => typeof r.categoryName === "string"),
    ).toBe(true);

    const got = await getEpiCatalogAction(created.data.id);
    expect(got.ok && got.data.name).toBe("Luva nitrílica");
    expect(got.ok && got.data.ca).toBe("55555");

    const updated = await updateEpiCatalogAction(created.data.id, {
      type: "epi",
      categoryId: categoryA,
      name: "Luva nitrílica G",
      caValidUntil: "2028-02-29",
    });
    expect(updated.ok && updated.data.name).toBe("Luva nitrílica G");
    expect(updated.ok && updated.data.caValidUntil).toBe("2028-02-29");

    const del = await deleteEpiCatalogAction(created.data.id);
    expect(del.ok).toBe(true);

    const after = await listEpiCatalogAction({});
    expect(after.ok && after.data.total).toBe(1);
  });

  it("busca por nome, CA e nome da categoria; filtra por tipo", async () => {
    // categoryA = epi "Capacete"; item do seed tem ca "Capacete CA-123" (no nome) e ca null
    await createEpiCatalogAction({
      type: "epi",
      categoryId: categoryA,
      name: "Bota de segurança",
      ca: "BOOT-9",
    });

    const byName = await listEpiCatalogAction({ search: "Bota" });
    expect(byName.ok && byName.data.total).toBe(1);

    const byCa = await listEpiCatalogAction({ search: "BOOT-9" });
    expect(byCa.ok && byCa.data.total).toBe(1);

    const byCategory = await listEpiCatalogAction({ search: "Capacete" });
    // "Capacete" casa o nome da categoria (categoryA) → ambos os itens epi de org_a
    expect(byCategory.ok && byCategory.data.total).toBe(2);

    const epiOnly = await listEpiCatalogAction({ type: "epi" });
    expect(epiOnly.ok && epiOnly.data.rows.every((r) => r.type === "epi")).toBe(true);

    const machineOnly = await listEpiCatalogAction({ type: "machine" });
    expect(machineOnly.ok && machineOnly.data.total).toBe(0);
  });

  it("aceita itens homônimos no mesmo escritório (sem DUPLICATE)", async () => {
    const a = await createEpiCatalogAction({
      type: "epi",
      categoryId: categoryA,
      name: "Óculos",
    });
    const b = await createEpiCatalogAction({
      type: "epi",
      categoryId: categoryA,
      name: "Óculos",
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const list = await listEpiCatalogAction({ search: "Óculos" });
    expect(list.ok && list.data.total).toBe(2);
  });

  it("validação: tipo inválido / nome vazio / categoryId não-uuid / data inválida → VALIDATION", async () => {
    const badType = await createEpiCatalogAction({
      type: "ppe" as never,
      categoryId: categoryA,
      name: "X",
    });
    expect(!badType.ok && badType.error.code).toBe("VALIDATION");

    const emptyName = await createEpiCatalogAction({
      type: "epi",
      categoryId: categoryA,
      name: "  ",
    });
    expect(!emptyName.ok && emptyName.error.code).toBe("VALIDATION");

    const badUuid = await createEpiCatalogAction({
      type: "epi",
      categoryId: "nao-uuid",
      name: "X",
    });
    expect(!badUuid.ok && badUuid.error.code).toBe("VALIDATION");

    const badDate = await createEpiCatalogAction({
      type: "epi",
      categoryId: categoryA,
      name: "X",
      caValidUntil: "2026-13-45",
    });
    expect(!badDate.ok && badDate.error.code).toBe("VALIDATION");
  });

  it("preenche createdBy da sessão no create; nunca muda no update (#27); persiste replacementDate (#24)", async () => {
    const created = await createEpiCatalogAction({
      type: "epi",
      categoryId: categoryA,
      name: "Óculos de proteção",
      replacementDate: "2027-05-01",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.createdBy).toBe("u");
    expect(created.data.replacementDate).toBe("2027-05-01");

    const updated = await updateEpiCatalogAction(created.data.id, {
      type: "epi",
      categoryId: categoryA,
      name: "Óculos de proteção V2",
      replacementDate: "2027-06-01",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    // createdBy é imutável — o update não sobrescreve com o userId do editor.
    expect(updated.data.createdBy).toBe("u");
    expect(updated.data.replacementDate).toBe("2027-06-01");
  });

  it("grava auditoria (#25) no create e no update, com resumo do diff", async () => {
    const created = await createEpiCatalogAction({
      type: "epi",
      categoryId: categoryA,
      name: "Protetor auricular",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const afterCreate = await listEpiCatalogAuditAction(created.data.id);
    expect(afterCreate.ok && afterCreate.data).toHaveLength(1);
    expect(afterCreate.ok && afterCreate.data[0].summary).toBe("Item cadastrado.");
    expect(afterCreate.ok && afterCreate.data[0].changedBy).toBe("u");

    await updateEpiCatalogAction(created.data.id, {
      type: "epi",
      categoryId: categoryA,
      name: "Protetor auricular tipo concha",
    });

    const afterUpdate = await listEpiCatalogAuditAction(created.data.id);
    expect(afterUpdate.ok && afterUpdate.data).toHaveLength(2);
    // Mais recente primeiro.
    expect(afterUpdate.ok && afterUpdate.data[0].summary).toContain("nome de");
  });
});
