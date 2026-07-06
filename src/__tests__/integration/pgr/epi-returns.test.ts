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
} from "@/shared/server/actions/pgr/epi-deliveries";
import {
  recordReturnAction,
  listPendingReturnsAction,
} from "@/shared/server/actions/pgr/epi-returns";

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

async function readBalance(admin: ReturnType<typeof postgres>, stockId: string) {
  const [row] = await admin<{ balance: number }[]>`
    select balance from public.epi_stock where id = ${stockId}`;
  return row.balance;
}

async function itemsOf(admin: ReturnType<typeof postgres>, deliveryId: string) {
  return admin<{ id: string; returned_at: Date | null }[]>`
    select id, returned_at from public.epi_delivery_items where delivery_id = ${deliveryId}`;
}

/** Cria uma entrega assinada (deu baixa) em org_a sobre epiStockA; retorna ids. */
async function signedDelivery(
  admin: ReturnType<typeof postgres>,
  quantity: number,
  deliveryDate = DATE,
): Promise<{ deliveryId: string; itemId: string }> {
  const created = await createDeliveryAction({
    employeeId: I.employeeA,
    deliveryDate,
    items: [{ stockId: I.epiStockA, quantity: String(quantity) }],
  });
  if (!created.ok) throw new Error("setup: createDelivery falhou");
  const signed = await signDeliveryManualAction(created.data.id);
  if (!signed.ok) throw new Error("setup: sign falhou");
  const [item] = await itemsOf(admin, created.data.id);
  return { deliveryId: created.data.id, itemId: item.id };
}

(shouldRun ? describe : describe.skip)("Server Actions — epi_returns (012)", () => {
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

  it("devolução repõe o saldo, carimba returned_at e cria 1 employee_return com delivery_id", async () => {
    const { deliveryId, itemId } = await signedDelivery(admin, 3);
    expect(await readBalance(admin, I.epiStockA)).toBe(7); // 10 - 3

    const res = await recordReturnAction({
      deliveryId,
      returnDate: DATE,
      itemIds: [itemId],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.newBalances[0].balance).toBe(10); // 7 + 3
    expect(await readBalance(admin, I.epiStockA)).toBe(10);

    const [item] = await itemsOf(admin, deliveryId);
    expect(item.returned_at).not.toBeNull();

    const movs = await admin<{ type: string; delivery_id: string | null }[]>`
      select type, delivery_id from public.stock_movements
      where delivery_id = ${deliveryId} and type = 'employee_return'`;
    expect(movs).toHaveLength(1);
    expect(movs[0].delivery_id).toBe(deliveryId);
  });

  it("devolver item já devolvido → ALREADY_RETURNED (saldo inalterado)", async () => {
    const { deliveryId, itemId } = await signedDelivery(admin, 2);
    const first = await recordReturnAction({
      deliveryId,
      returnDate: DATE,
      itemIds: [itemId],
    });
    expect(first.ok).toBe(true);
    expect(await readBalance(admin, I.epiStockA)).toBe(10);

    const second = await recordReturnAction({
      deliveryId,
      returnDate: DATE,
      itemIds: [itemId],
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("ALREADY_RETURNED");
    expect(await readBalance(admin, I.epiStockA)).toBe(10); // sem dupla reposição
  });

  it("entrega ainda pendente (não assinada) → VALIDATION (nada a devolver)", async () => {
    // epiDeliveryA do seed nasce 'pending'
    const [item] = await itemsOf(admin, I.epiDeliveryA);
    const res = await recordReturnAction({
      deliveryId: I.epiDeliveryA,
      returnDate: DATE,
      itemIds: [item.id],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
  });

  it("data de devolução anterior à entrega → VALIDATION", async () => {
    const { deliveryId, itemId } = await signedDelivery(admin, 1, DATE);
    const res = await recordReturnAction({
      deliveryId,
      returnDate: "2026-06-20",
      itemIds: [itemId],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
  });

  it("item inexistente / de outra entrega → NOT_FOUND", async () => {
    const { deliveryId } = await signedDelivery(admin, 1);
    const res = await recordReturnAction({
      deliveryId,
      returnDate: DATE,
      itemIds: [MISSING_ID],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  it("entrega de outro tenant → NOT_FOUND (isolamento)", async () => {
    // epiDeliveryB é de org_b; tenant ativo é org_a
    const [item] = await itemsOf(admin, I.epiDeliveryB);
    const res = await recordReturnAction({
      deliveryId: I.epiDeliveryB,
      returnDate: DATE,
      itemIds: [item.id],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
    // saldo do item de B intacto
    expect(await readBalance(admin, I.epiStockB)).toBe(5);
  });

  it("listPendingReturns mostra item assinado e some após devolver; ignora pendente", async () => {
    const { deliveryId, itemId } = await signedDelivery(admin, 2);

    const before = await listPendingReturnsAction({});
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data.rows.some((r) => r.itemId === itemId)).toBe(true);
    // o item da entrega 'pending' do seed NÃO aparece
    const seedPending = await itemsOf(admin, I.epiDeliveryA);
    expect(before.data.rows.some((r) => r.itemId === seedPending[0].id)).toBe(false);

    await recordReturnAction({ deliveryId, returnDate: DATE, itemIds: [itemId] });
    const after = await listPendingReturnsAction({});
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.data.rows.some((r) => r.itemId === itemId)).toBe(false);
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await listPendingReturnsAction({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });
});
