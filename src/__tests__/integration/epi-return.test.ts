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
  returnDeliveryItemAction,
  signDeliveryManualAction,
} from "@/shared/server/actions/pgr/epi-deliveries";

import { adminClient, applyMigrations } from "./_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const DATE = "2026-07-04";

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Devolução de item de entrega (012/US4)", () => {
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

  async function readBalance(stockId: string): Promise<number> {
    const [row] = await admin<{ balance: number }[]>`
      select balance from public.epi_stock where id = ${stockId}`;
    return row.balance;
  }

  async function itemIdOf(deliveryId: string): Promise<string> {
    const [row] = await admin<{ id: string }[]>`
      select id from public.epi_delivery_items where delivery_id = ${deliveryId}`;
    return row.id;
  }

  // entrega real via action (baixa 4 do saldo 10 → 6) para devolver em seguida
  async function createDeliveryOf4(): Promise<{ deliveryId: string; itemId: string }> {
    const created = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: DATE,
      items: [{ stockId: I.epiStockA, quantity: 4 }],
    });
    if (!created.ok) throw new Error(`setup failed: ${created.error.code}`);
    return { deliveryId: created.data.id, itemId: await itemIdOf(created.data.id) };
  }

  it("devolução repõe o saldo EXATO e grava movimento employee_return vinculado", async () => {
    const { deliveryId, itemId } = await createDeliveryOf4();
    expect(await readBalance(I.epiStockA)).toBe(6);

    const res = await returnDeliveryItemAction(deliveryId, { itemId });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.newBalance).toBe(10);
    expect(await readBalance(I.epiStockA)).toBe(10);

    const [item] = await admin<{ returned_at: Date | null }[]>`
      select returned_at from public.epi_delivery_items where id = ${itemId}`;
    expect(item.returned_at).not.toBeNull();

    const movements = await admin<{ type: string; quantity: number }[]>`
      select type, quantity from public.stock_movements
      where delivery_id = ${deliveryId} and type = 'employee_return'`;
    expect(movements).toHaveLength(1);
    expect(movements[0].quantity).toBe(4);
  });

  it("2ª devolução → ALREADY_RETURNED com saldo intacto (one-shot)", async () => {
    const { deliveryId, itemId } = await createDeliveryOf4();
    await returnDeliveryItemAction(deliveryId, { itemId });

    const second = await returnDeliveryItemAction(deliveryId, { itemId });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("ALREADY_RETURNED");

    expect(await readBalance(I.epiStockA)).toBe(10); // não repôs 2×
    const [{ c }] = await admin<{ c: number }[]>`
      select count(*)::int as c from public.stock_movements
      where delivery_id = ${deliveryId} and type = 'employee_return'`;
    expect(c).toBe(1);
  });

  it("item de outro tenant → NOT_FOUND (nada gravado)", async () => {
    const foreignItemId = await itemIdOf(I.epiDeliveryB);
    const res = await returnDeliveryItemAction(I.epiDeliveryB, {
      itemId: foreignItemId,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");

    const [item] = await admin<{ returned_at: Date | null }[]>`
      select returned_at from public.epi_delivery_items where id = ${foreignItemId}`;
    expect(item.returned_at).toBeNull();
    expect(await readBalance(I.epiStockB)).toBe(5);
  });

  it("devolução independe do status de assinatura (entrega assinada devolve normalmente)", async () => {
    const { deliveryId, itemId } = await createDeliveryOf4();
    const signed = await signDeliveryManualAction(deliveryId);
    expect(signed.ok).toBe(true);

    const res = await returnDeliveryItemAction(deliveryId, { itemId });
    expect(res.ok).toBe(true);
    expect(await readBalance(I.epiStockA)).toBe(10);
  });

  it("papel client → FORBIDDEN (nada gravado)", async () => {
    const { deliveryId, itemId } = await createDeliveryOf4();
    mockedGate.mockRejectedValue(new ForbiddenError());

    const res = await returnDeliveryItemAction(deliveryId, { itemId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
    expect(await readBalance(I.epiStockA)).toBe(6); // baixa da entrega mantida
  });
});
