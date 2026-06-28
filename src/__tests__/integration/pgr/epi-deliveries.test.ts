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
  createDeliveryAction,
  signDeliveryManualAction,
  getDeliveryAction,
  listDeliverableStockAction,
} from "@/shared/server/actions/pgr/epi-deliveries";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const DATE = "2026-06-26";
const MISSING_ID = "99999999-9999-9999-9999-999999999999";

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

async function readBalance(
  admin: ReturnType<typeof postgres>,
  stockId: string,
): Promise<number> {
  const [row] = await admin<{ balance: number }[]>`
    select balance from public.epi_stock where id = ${stockId}`;
  return row.balance;
}

async function countMovements(
  admin: ReturnType<typeof postgres>,
  stockId: string,
): Promise<number> {
  const [row] = await admin<{ c: number }[]>`
    select count(*)::int as c from public.stock_movements where stock_id = ${stockId}`;
  return row.c;
}

async function deliveryStatus(
  admin: ReturnType<typeof postgres>,
  deliveryId: string,
): Promise<string> {
  const [row] = await admin<{ signature_status: string }[]>`
    select signature_status from public.epi_deliveries where id = ${deliveryId}`;
  return row.signature_status;
}

/** Cria um 2º item de estoque em org_a com saldo/mínima informados; retorna stockId. */
async function addStockA(
  admin: ReturnType<typeof postgres>,
  opts: { balance: number; min: number; name?: string },
): Promise<string> {
  const [cat] = await admin<{ id: string }[]>`
    insert into public.epi_catalog (org_id, type, category_id, name)
    values ('org_a', 'epi', ${I.categoryA}, ${opts.name ?? "Luva CA-456"}) returning id`;
  const [stock] = await admin<{ id: string }[]>`
    insert into public.epi_stock (org_id, catalog_id, balance, min_quantity)
    values ('org_a', ${cat.id}, ${opts.balance}, ${opts.min}) returning id`;
  return stock.id;
}

(shouldRun ? describe : describe.skip)("Server Actions — epi_deliveries US1 (011)", () => {
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

  // ---- Criação: entrega pendente SEM baixa ----
  it("cria entrega pending + itens, sem mexer no saldo", async () => {
    const res = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [{ stockId: I.epiStockA, quantity: "3" }],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.deliveryId).toBeTruthy();
    expect(res.data.authToken).toMatch(/^[0-9a-f]{64}$/);
    expect(await deliveryStatus(admin, res.data.deliveryId)).toBe("pending");
    // saldo e movimentos inalterados (baixa só na confirmação)
    expect(await readBalance(admin, I.epiStockA)).toBe(10);
    expect(await countMovements(admin, I.epiStockA)).toBe(1); // só o purchase do seed
  });

  it("criação com quantity > saldo (disponibilidade) → INSUFFICIENT_STOCK, nada gravado", async () => {
    const res = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [{ stockId: I.epiStockA, quantity: "999" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INSUFFICIENT_STOCK");
    expect(await readBalance(admin, I.epiStockA)).toBe(10);
  });

  it("criação com stockId duplicado → VALIDATION", async () => {
    const res = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [
        { stockId: I.epiStockA, quantity: "1" },
        { stockId: I.epiStockA, quantity: "2" },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
  });

  it("criação para funcionário de outro tenant → NOT_FOUND", async () => {
    const res = await createDeliveryAction({
      employeeId: I.employeeB,
      deliveryDate: DATE,
      items: [{ stockId: I.epiStockA, quantity: "1" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  // ---- Assinatura manual: baixa transacional multi-item ----
  it("assina manual: baixa saldo, 1 employee_delivery/item (com delivery_id) e status signed_manual", async () => {
    const stock2 = await addStockA(admin, { balance: 8, min: 0 });
    const created = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [
        { stockId: I.epiStockA, quantity: "4" },
        { stockId: stock2, quantity: "5" },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const signed = await signDeliveryManualAction(created.data.deliveryId);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.data.delivery.signatureStatus).toBe("signed_manual");
    expect(await deliveryStatus(admin, created.data.deliveryId)).toBe("signed_manual");

    // saldos baixados
    expect(await readBalance(admin, I.epiStockA)).toBe(6); // 10 - 4
    expect(await readBalance(admin, stock2)).toBe(3); // 8 - 5

    // 1 movimento employee_delivery por item, vinculado à entrega
    const movs = await admin<{ type: string; delivery_id: string | null }[]>`
      select type, delivery_id from public.stock_movements
      where delivery_id = ${created.data.deliveryId}`;
    expect(movs).toHaveLength(2);
    expect(movs.every((m) => m.type === "employee_delivery")).toBe(true);
    expect(movs.every((m) => m.delivery_id === created.data.deliveryId)).toBe(true);
  });

  it("saldo insuficiente em UM item → rollback total (nada assinado, nada baixado)", async () => {
    const stock2 = await addStockA(admin, { balance: 1, min: 0 });
    const created = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [
        { stockId: I.epiStockA, quantity: "2" },
        { stockId: stock2, quantity: "1" },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // zera o stock2 por fora ANTES de assinar (simula concorrência) → baixa falha
    await admin`update public.epi_stock set balance = 0 where id = ${stock2}`;

    const signed = await signDeliveryManualAction(created.data.deliveryId);
    expect(signed.ok).toBe(false);
    if (!signed.ok) expect(signed.error.code).toBe("INSUFFICIENT_STOCK");

    // rollback: entrega segue pending, nenhum saldo alterado, nenhum movimento de entrega
    expect(await deliveryStatus(admin, created.data.deliveryId)).toBe("pending");
    expect(await readBalance(admin, I.epiStockA)).toBe(10);
    expect(await readBalance(admin, stock2)).toBe(0);
    expect(await countMovements(admin, I.epiStockA)).toBe(1); // só o purchase do seed
  });

  it("aviso de mínima quando a baixa cruza min_quantity (não bloqueia)", async () => {
    // epiStockA: balance 10, min 2 → baixa de 9 deixa 1 (< min) → aviso
    const created = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [{ stockId: I.epiStockA, quantity: "9" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const signed = await signDeliveryManualAction(created.data.deliveryId);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(await readBalance(admin, I.epiStockA)).toBe(1);
    expect(signed.data.lowStockWarnings).toHaveLength(1);
    expect(signed.data.lowStockWarnings[0].balance).toBe(1);
  });

  it("assinar entrega já assinada → ALREADY_SIGNED", async () => {
    const created = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [{ stockId: I.epiStockA, quantity: "1" }],
    });
    if (!created.ok) throw new Error("setup falhou");
    const first = await signDeliveryManualAction(created.data.deliveryId);
    expect(first.ok).toBe(true);
    const second = await signDeliveryManualAction(created.data.deliveryId);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("ALREADY_SIGNED");
  });

  it("assinar entrega inexistente / de outro tenant → NOT_FOUND", async () => {
    const missing = await signDeliveryManualAction(MISSING_ID);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");
    const crossTenant = await signDeliveryManualAction(I.epiDeliveryB); // org_b
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) expect(crossTenant.error.code).toBe("NOT_FOUND");
  });

  // ---- Seleção (listDeliverableStock): só itens com saldo ----
  it("listDeliverableStock retorna só itens com saldo > 0", async () => {
    await addStockA(admin, { balance: 0, min: 0, name: "Óculos sem saldo" });
    const res = await listDeliverableStockAction({});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.rows.every((r) => r.currentBalance > 0)).toBe(true);
    expect(res.data.rows.some((r) => r.id === I.epiStockA)).toBe(true);
  });

  // ---- Leitura ----
  it("getDelivery retorna cabeçalho + itens; cross-tenant → NOT_FOUND", async () => {
    const created = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [{ stockId: I.epiStockA, quantity: "2" }],
    });
    if (!created.ok) throw new Error("setup falhou");
    const detail = await getDeliveryAction(created.data.deliveryId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.data.signatureStatus).toBe("pending");
    expect(detail.data.items).toHaveLength(1);
    expect(detail.data.items[0].quantity).toBe(2);

    const cross = await getDeliveryAction(I.epiDeliveryB);
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.error.code).toBe("NOT_FOUND");
  });

  // ---- Autorização ----
  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await listDeliverableStockAction({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });
});
