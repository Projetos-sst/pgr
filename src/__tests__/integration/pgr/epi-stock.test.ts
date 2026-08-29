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
  listEpiStockAction,
  getEpiStockAction,
  createEpiStockAction,
  updateEpiStockAction,
  deleteEpiStockAction,
  getEpiStockDependentsAction,
} from "@/shared/server/actions/pgr/epi-stock";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

// cria um item de catálogo novo (sem estoque) no org_a para os testes de create
async function freshCatalog(admin: ReturnType<typeof postgres>): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into public.epi_catalog (org_id, type, category_id, name)
    values ('org_a', 'epi', ${I.categoryA}, 'Luva nova') returning id`;
  return row.id;
}

// cria um item de catálogo em org_a com categoria/validade de CA customizadas
// (usados pelos testes de filtro de categoria e de validade de CA, #28).
async function freshCatalogWith(
  admin: ReturnType<typeof postgres>,
  opts: { categoryId?: string; caValidUntil?: string | null; name?: string },
): Promise<string> {
  const categoryId = opts.categoryId ?? I.categoryA;
  const [row] = await admin<{ id: string }[]>`
    insert into public.epi_catalog (org_id, type, category_id, name, ca_valid_until)
    values ('org_a', 'epi', ${categoryId}, ${opts.name ?? "Item filtro"}, ${opts.caValidUntil ?? null})
    returning id`;
  return row.id;
}

(shouldRun ? describe : describe.skip)("Server Actions — epi_stock CRUD (009)", () => {
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

  it("list só do tenant ativo, com status derivado", async () => {
    const result = await listEpiStockAction({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1); // epiStockA (org_a)
      expect(result.data.rows[0].currentBalance).toBe(10);
      expect(result.data.rows[0].minimumQuantity).toBe(2);
      expect(result.data.rows[0].status).toBe("acima_minima");
    }
  });

  it("getById de outro tenant → NOT_FOUND", async () => {
    expect((await getEpiStockAction(I.epiStockA)).ok).toBe(true);
    const other = await getEpiStockAction(I.epiStockB);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.error.code).toBe("NOT_FOUND");
  });

  it("create associa item e inicia saldo em 0 (não escreve balance)", async () => {
    const catalogId = await freshCatalog(admin);
    const created = await createEpiStockAction({ catalogId, minimumQuantity: "7" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.balance).toBe(0); // saldo nunca escrito por create
    expect(created.data.minQuantity).toBe(7);
    const detail = await getEpiStockAction(created.data.id);
    expect(detail.ok && detail.data.status).toBe("sem_saldo");
  });

  it("create com initialQuantity lança um movimento `purchase` e o balance reflete o saldo inicial (#22)", async () => {
    const catalogId = await freshCatalog(admin);
    const created = await createEpiStockAction({
      catalogId,
      minimumQuantity: "0",
      initialQuantity: "10",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.balance).toBe(10); // reflete o saldo pós-movimento, não 0

    const detail = await getEpiStockAction(created.data.id);
    expect(detail.ok && detail.data.currentBalance).toBe(10);

    const movements = await admin<{ type: string; quantity: number }[]>`
      select type, quantity from public.stock_movements where stock_id = ${created.data.id}`;
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe("purchase");
    expect(movements[0].quantity).toBe(10);
  });

  it("create sem initialQuantity (ou zero) não lança movimentação — comportamento anterior preservado", async () => {
    const catalogId = await freshCatalog(admin);
    const created = await createEpiStockAction({
      catalogId,
      minimumQuantity: "0",
      initialQuantity: "0",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.balance).toBe(0);

    const movements = await admin<{ id: string }[]>`
      select id from public.stock_movements where stock_id = ${created.data.id}`;
    expect(movements).toHaveLength(0);
  });

  it("create de item já no estoque → DUPLICATE (UNIQUE org,catalog)", async () => {
    const dup = await createEpiStockAction({
      catalogId: I.epiCatalogA,
      minimumQuantity: "1",
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("DUPLICATE");
  });

  it("create com catalog_id inexistente → FK_NOT_FOUND", async () => {
    const bad = await createEpiStockAction({
      catalogId: "99999999-9999-9999-9999-999999999999",
      minimumQuantity: "1",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("FK_NOT_FOUND");
  });

  it("create com mínima negativa → VALIDATION", async () => {
    const catalogId = await freshCatalog(admin);
    const bad = await createEpiStockAction({ catalogId, minimumQuantity: "-1" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("VALIDATION");
  });

  it("update edita só a mínima; balance permanece (somente leitura)", async () => {
    const updated = await updateEpiStockAction(I.epiStockA, { minimumQuantity: "20" });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.data.balance).toBe(10); // inalterado
    const detail = await getEpiStockAction(I.epiStockA);
    // agora 10 < 20 → abaixo_minima (status derivado reflete a nova mínima)
    expect(detail.ok && detail.data.status).toBe("abaixo_minima");
    expect(detail.ok && detail.data.currentBalance).toBe(10);
  });

  it("update de outro tenant → NOT_FOUND", async () => {
    const res = await updateEpiStockAction(I.epiStockB, { minimumQuantity: "1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  it("dependents conta movimentações; delete remove em cascata", async () => {
    const deps = await getEpiStockDependentsAction(I.epiStockA);
    expect(deps.ok && deps.data.movements).toBe(1); // seed: 1 movimento purchase
    const del = await deleteEpiStockAction(I.epiStockA);
    expect(del.ok).toBe(true);
    expect((await getEpiStockAction(I.epiStockA)).ok).toBe(false);
  });

  it("delete de outro tenant → NOT_FOUND", async () => {
    const res = await deleteEpiStockAction(I.epiStockB);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  it("filtro de status e 'apenas com saldo'", async () => {
    const catalogId = await freshCatalog(admin);
    await createEpiStockAction({ catalogId, minimumQuantity: "0" }); // balance 0 → sem_saldo

    const semSaldo = await listEpiStockAction({ status: "sem_saldo" });
    expect(semSaldo.ok && semSaldo.data.total).toBe(1);

    const acima = await listEpiStockAction({ status: "acima_minima" });
    expect(acima.ok && acima.data.total).toBe(1); // epiStockA

    const comSaldo = await listEpiStockAction({ withBalanceOnly: true });
    expect(comSaldo.ok && comSaldo.data.total).toBe(1); // só epiStockA tem saldo
  });

  it("sem filtro de categoria/CA, mantém o comportamento atual (#28)", async () => {
    const result = await listEpiStockAction({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.total).toBe(1); // epiStockA, sem alteração
  });

  it("filtro por categoria retorna só itens daquela categoria (#28)", async () => {
    // nova categoria em org_a, distinta de categoryA (que já tem epiStockA)
    const [otherCategory] = await admin<{ id: string }[]>`
      insert into public.categories (org_id, type, name)
      values ('org_a', 'epi', 'Categoria filtro') returning id`;

    const catalogId = await freshCatalogWith(admin, { categoryId: otherCategory.id });
    await createEpiStockAction({ catalogId, minimumQuantity: "0" });

    const byOtherCategory = await listEpiStockAction({ categoryId: otherCategory.id });
    expect(byOtherCategory.ok && byOtherCategory.data.total).toBe(1);
    expect(byOtherCategory.ok && byOtherCategory.data.rows[0].catalogId).toBe(catalogId);

    const byCategoryA = await listEpiStockAction({ categoryId: I.categoryA });
    expect(byCategoryA.ok && byCategoryA.data.total).toBe(1); // só epiStockA
    expect(byCategoryA.ok && byCategoryA.data.rows[0].catalogId).toBe(I.epiCatalogA);

    const noFilter = await listEpiStockAction({});
    expect(noFilter.ok && noFilter.data.total).toBe(2); // ambos, sem filtro
  });

  it("filtro caStatus='expired' retorna só itens com CA vencido (#28)", async () => {
    const expiredCatalogId = await freshCatalogWith(admin, {
      caValidUntil: "2020-01-01",
      name: "CA vencido",
    });
    await createEpiStockAction({ catalogId: expiredCatalogId, minimumQuantity: "0" });

    const futureCatalogId = await freshCatalogWith(admin, {
      caValidUntil: "2099-01-01",
      name: "CA válido futuro",
    });
    await createEpiStockAction({ catalogId: futureCatalogId, minimumQuantity: "0" });

    // epiStockA (seed) tem ca_valid_until NULL — não deve ser escondido pelo filtro "valid"
    const expired = await listEpiStockAction({ caStatus: "expired" });
    expect(expired.ok && expired.data.total).toBe(1);
    expect(expired.ok && expired.data.rows[0].catalogId).toBe(expiredCatalogId);

    const valid = await listEpiStockAction({ caStatus: "valid" });
    expect(valid.ok && valid.data.total).toBe(2); // epiStockA (CA nulo) + futureCatalogId
    const validCatalogIds = valid.ok ? valid.data.rows.map((r) => r.catalogId) : [];
    expect(validCatalogIds).toEqual(
      expect.arrayContaining([I.epiCatalogA, futureCatalogId]),
    );
    expect(validCatalogIds).not.toContain(expiredCatalogId);

    const noFilter = await listEpiStockAction({});
    expect(noFilter.ok && noFilter.data.total).toBe(3); // sem filtro, todos aparecem
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const result = await listEpiStockAction({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
