jest.mock("@/shared/db/with-org", () => ({ withOrg: jest.fn() }));
jest.mock("@/shared/db/repositories/audited-write", () => ({
  auditedTenantWrite: jest.fn((_orgId, _op, write: () => Promise<unknown>) => write()),
}));

import { canReturn, returnSchema } from "@/shared/domains/pgr/epi-deliveries";
import {
  computeRunningBalance,
  signedQuantity,
  stockMovementTypeLabel,
} from "@/shared/domains/pgr/stock-movements";
import { applyStockEntry } from "@/shared/db/repositories/stock-movements";

type StockRow = { id: string; balance: number };

// Mesma transação falsa de stock-movements-helpers (cadeias mínimas dos helpers).
function fakeTx(stockRow: StockRow | undefined) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const tx = {
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({
          for: () => ({ limit: async () => (stockRow ? [stockRow] : []) }),
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

describe("canReturn (guard one-shot da devolução)", () => {
  it("returned_at NULL → pode devolver", () => {
    expect(canReturn(null)).toBe(true);
  });

  it("returned_at preenchido → NÃO devolve 2×", () => {
    expect(canReturn(new Date("2026-07-01T12:00:00Z"))).toBe(false);
  });
});

describe("returnSchema", () => {
  it("aceita itemId uuid e rejeita vazio/malformado", () => {
    expect(
      returnSchema.safeParse({ itemId: "11111111-1111-1111-1111-1111111111a9" }).success,
    ).toBe(true);
    expect(returnSchema.safeParse({ itemId: "" }).success).toBe(false);
    expect(returnSchema.safeParse({ itemId: "nao-e-uuid" }).success).toBe(false);
    expect(returnSchema.safeParse({}).success).toBe(false);
  });
});

describe("employee_return no vocabulário de movimentos", () => {
  it("signedQuantity soma (entrada) — espelho do CASE da window function", () => {
    expect(signedQuantity("employee_return", 3)).toBe(3);
    expect(signedQuantity("employee_delivery", 3)).toBe(-3);
  });

  it("computeRunningBalance aplica a devolução como entrada", () => {
    expect(
      computeRunningBalance([
        { type: "purchase", quantity: 10 },
        { type: "employee_delivery", quantity: 4 },
        { type: "employee_return", quantity: 4 },
      ]),
    ).toEqual([10, 6, 10]);
  });

  it("tem rótulo pt-BR próprio", () => {
    expect(stockMovementTypeLabel("employee_return")).toBe("Devolução de funcionário");
  });
});

describe("applyStockEntry com employee_return", () => {
  it("repõe EXATAMENTE +quantity e vincula o movimento à entrega", async () => {
    const { tx, inserted, updated } = fakeTx({ id: "stock-1", balance: 6 });

    const result = await applyStockEntry(tx, {
      orgId: "org_a",
      stockId: "stock-1",
      quantity: 4,
      type: "employee_return",
      deliveryId: "delivery-9",
    });

    expect(result.newBalance).toBe(10);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      type: "employee_return",
      quantity: 4,
      deliveryId: "delivery-9",
    });
    expect(updated[0]).toMatchObject({ balance: 10 });
  });
});
