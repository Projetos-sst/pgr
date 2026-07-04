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
  deleteDeliveryAction,
  getDeliveryAction,
  listDeliveriesAction,
  signDeliveryManualAction,
} from "@/shared/server/actions/pgr/epi-deliveries";

import { adminClient, applyMigrations, withOrgTx } from "./_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const DATE = "2026-07-03";
const STOCK2 = "11111111-1111-1111-1111-1111111111c1";

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

// segundo item de estoque em org_a para o cenário multi-item
async function seedSecondStock(admin: ReturnType<typeof postgres>): Promise<void> {
  await admin.unsafe(`
    insert into public.epi_catalog (id, org_id, type, category_id, name)
    values ('${STOCK2.replace(/c1$/, "c0")}', 'org_a', 'epi', '${I.categoryA}', 'Luva CA-456');
    insert into public.epi_stock (id, org_id, catalog_id, balance, min_quantity)
    values ('${STOCK2}', 'org_a', '${STOCK2.replace(/c1$/, "c0")}', 5, 0);
  `);
}

(shouldRun ? describe : describe.skip)(
  "Server Actions — epi_deliveries (012/US2)",
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
      await seedSecondStock(admin);
      mockedGate.mockReset();
      asOwner("org_a");
    });

    // ---- criação + baixa atômica ----
    it("entrega multi-item reduz o saldo de cada item e vincula os movimentos", async () => {
      const res = await createDeliveryAction({
        employeeId: I.employeeA,
        deliveryDate: DATE,
        items: [
          { stockId: I.epiStockA, quantity: 4 },
          { stockId: STOCK2, quantity: 2 },
        ],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.signatureStatus).toBe("pending");
      expect(await readBalance(admin, I.epiStockA)).toBe(6); // 10 - 4
      expect(await readBalance(admin, STOCK2)).toBe(3); // 5 - 2

      const movements = await admin<{ type: string; delivery_id: string | null }[]>`
      select type, delivery_id from public.stock_movements
      where delivery_id = ${res.data.id}`;
      expect(movements).toHaveLength(2);
      expect(movements.every((m) => m.type === "employee_delivery")).toBe(true);

      const items = await admin<{ catalog_id: string; quantity: number }[]>`
      select catalog_id, quantity from public.epi_delivery_items
      where delivery_id = ${res.data.id}`;
      expect(items).toHaveLength(2);
      // catalogId derivado da linha de estoque travada, não de input do cliente
      expect(items.map((i) => i.catalog_id).sort()).toEqual(
        [I.epiCatalogA, STOCK2.replace(/c1$/, "c0")].sort(),
      );
    });

    it("qualquer item sem saldo → INSUFFICIENT_STOCK com rollback TOTAL", async () => {
      const res = await createDeliveryAction({
        employeeId: I.employeeA,
        deliveryDate: DATE,
        items: [
          { stockId: I.epiStockA, quantity: 4 }, // teria saldo
          { stockId: STOCK2, quantity: 999 }, // não tem
        ],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("INSUFFICIENT_STOCK");

      // nada persistiu: saldos intactos, nenhuma entrega/item/movimento novo
      expect(await readBalance(admin, I.epiStockA)).toBe(10);
      expect(await readBalance(admin, STOCK2)).toBe(5);
      const [{ c }] = await admin<{ c: number }[]>`
      select count(*)::int as c from public.epi_deliveries where org_id = 'org_a'`;
      expect(c).toBe(1); // só a do seed
    });

    it("funcionário de outro tenant → NOT_FOUND (nada gravado)", async () => {
      const res = await createDeliveryAction({
        employeeId: I.employeeB,
        deliveryDate: DATE,
        items: [{ stockId: I.epiStockA, quantity: 1 }],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
      expect(await readBalance(admin, I.epiStockA)).toBe(10);
    });

    it("estoque de outro tenant → NOT_FOUND (nada gravado)", async () => {
      const res = await createDeliveryAction({
        employeeId: I.employeeA,
        deliveryDate: DATE,
        items: [{ stockId: I.epiStockB, quantity: 1 }],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
      expect(await readBalance(admin, I.epiStockB)).toBe(5);
    });

    // ---- assinatura manual (one-shot) ----
    it("assinatura manual transiciona pending → signed_manual; repetida → ALREADY_SIGNED", async () => {
      const first = await signDeliveryManualAction(I.epiDeliveryA);
      expect(first.ok).toBe(true);

      const [row] = await admin<{ signature_status: string }[]>`
      select signature_status from public.epi_deliveries where id = ${I.epiDeliveryA}`;
      expect(row.signature_status).toBe("signed_manual");

      const second = await signDeliveryManualAction(I.epiDeliveryA);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error.code).toBe("ALREADY_SIGNED");
    });

    it("assinar entrega de outro tenant → NOT_FOUND", async () => {
      const res = await signDeliveryManualAction(I.epiDeliveryB);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
    });

    // ---- exclusão (guard de imutabilidade) ----
    it("DELETE de entrega pendente remove e faz SET NULL nos movimentos (saldo intacto)", async () => {
      const created = await createDeliveryAction({
        employeeId: I.employeeA,
        deliveryDate: DATE,
        items: [{ stockId: I.epiStockA, quantity: 2 }],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const res = await deleteDeliveryAction(created.data.id);
      expect(res.ok).toBe(true);

      // o movimento sobrevive com delivery_id nulo; o saldo NÃO é estornado
      const movements = await admin<{ delivery_id: string | null }[]>`
      select delivery_id from public.stock_movements
      where stock_id = ${I.epiStockA} and type = 'employee_delivery'`;
      expect(movements).toHaveLength(1);
      expect(movements[0].delivery_id).toBeNull();
      expect(await readBalance(admin, I.epiStockA)).toBe(8);
    });

    it("DELETE de entrega assinada → FORBIDDEN (imutável)", async () => {
      await signDeliveryManualAction(I.epiDeliveryA);
      const res = await deleteDeliveryAction(I.epiDeliveryA);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");

      const [{ c }] = await admin<{ c: number }[]>`
      select count(*)::int as c from public.epi_deliveries where id = ${I.epiDeliveryA}`;
      expect(c).toBe(1);
    });

    it("DELETE de entrega de outro tenant → NOT_FOUND", async () => {
      const res = await deleteDeliveryAction(I.epiDeliveryB);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
    });

    // ---- leitura ----
    it("get/list não cruzam tenant e o detalhe traz os itens", async () => {
      const detail = await getDeliveryAction(I.epiDeliveryA);
      expect(detail.ok).toBe(true);
      if (detail.ok) {
        expect(detail.data.employeeName).toBe("Func A");
        expect(detail.data.items).toHaveLength(1);
        expect(detail.data.signedAt).toBeNull(); // pendente → sem timestamp legal
      }

      const crossTenant = await getDeliveryAction(I.epiDeliveryB);
      expect(crossTenant.ok).toBe(false);
      if (!crossTenant.ok) expect(crossTenant.error.code).toBe("NOT_FOUND");

      const list = await listDeliveriesAction({ employeeId: I.employeeA });
      expect(list.ok).toBe(true);
      if (list.ok) {
        expect(list.data.total).toBe(1);
        expect(list.data.rows[0].itemCount).toBe(1);
      }
    });

    // ---- autorização ----
    it("papel client → FORBIDDEN (leitura e escrita)", async () => {
      mockedGate.mockRejectedValue(new ForbiddenError());

      const list = await listDeliveriesAction({});
      expect(list.ok).toBe(false);
      if (!list.ok) expect(list.error.code).toBe("FORBIDDEN");

      const create = await createDeliveryAction({
        employeeId: I.employeeA,
        deliveryDate: DATE,
        items: [{ stockId: I.epiStockA, quantity: 1 }],
      });
      expect(create.ok).toBe(false);
      if (!create.ok) expect(create.error.code).toBe("FORBIDDEN");
      expect(await readBalance(admin, I.epiStockA)).toBe(10);
    });

    // ---- RLS backstop (GRANT por papel) ----
    it("app_runtime sem tenant fixado não enxerga nenhuma entrega (RLS)", async () => {
      const postgresLib = (await import("postgres")).default;
      const runtime = postgresLib(APP_RUNTIME_URL!, { max: 1, prepare: false });
      try {
        const bare = await runtime<{ id: string }[]>`
        select id from public.epi_deliveries`;
        expect(bare).toHaveLength(0);

        const scoped = await withOrgTx(
          runtime,
          "org_a",
          (tx) => tx<{ org_id: string }[]>`select org_id from public.epi_deliveries`,
        );
        expect(scoped.every((r) => r.org_id === "org_a")).toBe(true);
        expect(scoped.length).toBeGreaterThan(0);
      } finally {
        await runtime.end({ timeout: 5 });
      }
    });
  },
);
