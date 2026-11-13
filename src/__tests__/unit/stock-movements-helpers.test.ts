jest.mock("@/shared/db/with-org", () => ({ withOrg: jest.fn() }));
jest.mock("@/shared/db/repositories/audited-write", () => ({
  auditedTenantWrite: jest.fn((_orgId, _op, write: () => Promise<unknown>) => write()),
}));

import { withOrg } from "@/shared/db/with-org";
import {
  applyStockEntry,
  applyStockExit,
  registerStockEntry,
  registerStockExit,
} from "@/shared/db/repositories/stock-movements";
import { InsufficientStockError } from "@/shared/errors/insufficient-stock-error";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";

type StockRow = { id: string; balance: number };
type CatalogRow = {
  type: "epi" | "machine";
  ca: string | null;
  caValidUntil: string | null;
};

const VALID_CATALOG: CatalogRow = { type: "epi", ca: "123", caValidUntil: "2099-12-31" };

/**
 * Transação Drizzle falsa: reproduz só as cadeias usadas pelos helpers
 * (select→from→where→for→limit, insert→values→returning, update→set→where)
 * e registra o que foi inserido/atualizado para asserção.
 */
function fakeTx(stockRow: StockRow | undefined, catalogRow: CatalogRow = VALID_CATALOG) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const tx = {
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({
          for: () => ({ limit: async () => (stockRow ? [stockRow] : []) }),
          limit: async () => [catalogRow],
        }),
      }),
    })),
    insert: jest.fn(() => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v);
        return { returning: async () => [{ id: "mov-1", ...v }] };
      },
    })),
    update: jest.fn(() => ({
      set: (s: Record<string, unknown>) => {
        updated.push(s);
        return { where: async () => undefined };
      },
    })),
  };
  return { tx: tx as never, inserted, updated };
}

const BASE = {
  orgId: "org_a",
  stockId: "stock-1",
  quantity: 4,
} as const;

describe("applyStockExit", () => {
  it("valida balance - qty >= 0, insere movimento e decrementa o saldo", async () => {
    const { tx, inserted, updated } = fakeTx({ id: "stock-1", balance: 10 });

    const result = await applyStockExit(tx, { ...BASE, type: "employee_delivery" });

    expect(result.newBalance).toBe(6);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      orgId: "org_a",
      stockId: "stock-1",
      type: "employee_delivery",
      quantity: 4,
      deliveryId: null,
    });
    expect(updated[0]).toMatchObject({ balance: 6 });
  });

  it("saldo insuficiente → InsufficientStockError sem inserir nem atualizar", async () => {
    const { tx, inserted, updated } = fakeTx({ id: "stock-1", balance: 3 });

    await expect(applyStockExit(tx, { ...BASE, type: "adjustment" })).rejects.toThrow(
      InsufficientStockError,
    );
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it("saída que zera o saldo é permitida (balance - qty == 0)", async () => {
    const { tx } = fakeTx({ id: "stock-1", balance: 4 });

    const result = await applyStockExit(tx, { ...BASE, type: "discard" });

    expect(result.newBalance).toBe(0);
  });

  it("aceita deliveryId e o grava no movimento", async () => {
    const { tx, inserted } = fakeTx({ id: "stock-1", balance: 10 });

    await applyStockExit(tx, {
      ...BASE,
      type: "employee_delivery",
      deliveryId: "delivery-9",
    });

    expect(inserted[0]).toMatchObject({ deliveryId: "delivery-9" });
  });

  it("estoque inexistente/cross-tenant → NotFoundError", async () => {
    const { tx } = fakeTx(undefined);

    await expect(applyStockExit(tx, { ...BASE, type: "adjustment" })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("applyStockEntry", () => {
  it("soma a quantidade ao saldo e insere o movimento", async () => {
    const { tx, inserted, updated } = fakeTx({ id: "stock-1", balance: 10 });

    const result = await applyStockEntry(tx, {
      ...BASE,
      quantity: 7,
      type: "purchase",
    });

    expect(result.newBalance).toBe(17);
    expect(inserted[0]).toMatchObject({ type: "purchase", quantity: 7 });
    expect(updated[0]).toMatchObject({ balance: 17 });
  });

  it("aceita deliveryId (reposição por devolução) e o grava no movimento", async () => {
    const { tx, inserted } = fakeTx({ id: "stock-1", balance: 2 });

    await applyStockEntry(tx, {
      ...BASE,
      quantity: 1,
      type: "purchase",
      deliveryId: "delivery-9",
    });

    expect(inserted[0]).toMatchObject({ deliveryId: "delivery-9" });
  });

  it("estoque inexistente → NotFoundError", async () => {
    const { tx } = fakeTx(undefined);

    await expect(applyStockEntry(tx, { ...BASE, type: "purchase" })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("applyStockEntry — CA do EPI na entrada por compra (NOB-180)", () => {
  const STOCK = { id: "stock-1", balance: 10 };
  const expiring = (caValidUntil: string | null): CatalogRow => ({
    ...VALID_CATALOG,
    caValidUntil,
  });

  afterEach(() => jest.useRealTimers());

  it("recusa compra de EPI com CA vencido e não grava movimento nem saldo", async () => {
    const { tx, inserted, updated } = fakeTx(STOCK, expiring("2020-01-01"));

    await expect(applyStockEntry(tx, { ...BASE, type: "purchase" })).rejects.toThrow(
      ValidationError,
    );
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it("recusa compra de EPI sem validade do CA", async () => {
    const { tx } = fakeTx(STOCK, expiring(null));

    await expect(applyStockEntry(tx, { ...BASE, type: "purchase" })).rejects.toThrow(
      "Informe o CA e a validade do CA",
    );
  });

  it("usa o dia de Brasília: às 22h do dia do vencimento (já amanhã em UTC) a compra ainda entra", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-11T01:00:00Z"));
    const { tx } = fakeTx(STOCK, expiring("2026-03-10"));

    const result = await applyStockEntry(tx, { ...BASE, type: "purchase" });

    expect(result.newBalance).toBe(14);
  });

  it("à 0h de Brasília do dia seguinte ao vencimento a compra é recusada", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-11T03:00:00Z"));
    const { tx } = fakeTx(STOCK, expiring("2026-03-10"));

    await expect(applyStockEntry(tx, { ...BASE, type: "purchase" })).rejects.toThrow(
      "CA 123 vencido em 10/03/2026",
    );
  });

  it("devolução de funcionário repõe o saldo mesmo com o CA vencido", async () => {
    const { tx } = fakeTx(STOCK, expiring("2020-01-01"));

    const result = await applyStockEntry(tx, { ...BASE, type: "employee_return" });

    expect(result.newBalance).toBe(14);
  });
});

describe("registerStockEntry/registerStockExit (contrato da #72 preservado)", () => {
  const mockedWithOrg = withOrg as jest.MockedFunction<typeof withOrg>;

  beforeEach(() => mockedWithOrg.mockReset());

  it("registerStockEntry: movimento purchase com movementDate/invoiceNumber e saldo somado", async () => {
    const { tx, inserted } = fakeTx({ id: "stock-1", balance: 10 });
    mockedWithOrg.mockImplementation(async (_orgId, fn) => fn(tx));

    const result = await registerStockEntry("org_a", {
      stockId: "stock-1",
      quantity: 7,
      movementDate: "2026-07-01",
      invoiceNumber: "NF-9",
    });

    expect(result.newBalance).toBe(17);
    expect(result.movement).toMatchObject({ type: "purchase" });
    expect(inserted[0]).toMatchObject({
      type: "purchase",
      quantity: 7,
      movementDate: "2026-07-01",
      invoiceNumber: "NF-9",
      deliveryId: null,
    });
  });

  it("registerStockExit: movimento com o type informado e saldo decrementado", async () => {
    const { tx, inserted } = fakeTx({ id: "stock-1", balance: 10 });
    mockedWithOrg.mockImplementation(async (_orgId, fn) => fn(tx));

    const result = await registerStockExit("org_a", {
      stockId: "stock-1",
      quantity: 4,
      movementDate: "2026-07-01",
      type: "adjustment",
    });

    expect(result.newBalance).toBe(6);
    expect(inserted[0]).toMatchObject({
      type: "adjustment",
      quantity: 4,
      movementDate: "2026-07-01",
      deliveryId: null,
    });
  });

  it("registerStockExit: saldo insuficiente continua rejeitando com InsufficientStockError", async () => {
    const { tx } = fakeTx({ id: "stock-1", balance: 3 });
    mockedWithOrg.mockImplementation(async (_orgId, fn) => fn(tx));

    await expect(
      registerStockExit("org_a", {
        stockId: "stock-1",
        quantity: 4,
        movementDate: "2026-07-01",
        type: "discard",
      }),
    ).rejects.toThrow(InsufficientStockError);
  });
});
