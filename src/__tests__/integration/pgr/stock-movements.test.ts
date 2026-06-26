import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  requireOfficeStaff: jest.fn(),
}));

import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { ForbiddenError, NoTenantContextError } from "@/shared/auth/errors";
import {
  registerStockEntryAction,
  registerStockExitAction,
  listStockMovementsAction,
} from "@/shared/server/actions/pgr/stock-movements";

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

// cria um item de estoque novo no org_a SEM movimentos (para o estado vazio do histórico)
async function freshStockNoMovements(
  admin: ReturnType<typeof postgres>,
): Promise<string> {
  const [cat] = await admin<{ id: string }[]>`
    insert into public.epi_catalog (org_id, type, category_id, name)
    values ('org_a', 'epi', ${I.categoryA}, 'Bota nova') returning id`;
  const [stock] = await admin<{ id: string }[]>`
    insert into public.epi_stock (org_id, catalog_id, balance, min_quantity)
    values ('org_a', ${cat.id}, 0, 0) returning id`;
  return stock.id;
}

(shouldRun ? describe : describe.skip)("Server Actions — stock_movements (010)", () => {
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

  // ---- US1: entrada ----
  it("entrada incrementa o saldo e cria movimento purchase", async () => {
    const res = await registerStockEntryAction({
      stockId: I.epiStockA,
      quantity: "7",
      movementDate: DATE,
      invoiceNumber: "NF-9",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.newBalance).toBe(17); // 10 (seed) + 7
    expect(res.data.movement.type).toBe("purchase");
    expect(await readBalance(admin, I.epiStockA)).toBe(17);
    expect(await countMovements(admin, I.epiStockA)).toBe(2); // seed(1) + 1
  });

  it("entrada com quantidade <= 0 → VALIDATION (nada gravado)", async () => {
    const res = await registerStockEntryAction({
      stockId: I.epiStockA,
      quantity: "0",
      movementDate: DATE,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    expect(await readBalance(admin, I.epiStockA)).toBe(10);
  });

  it("entrada em stockId inexistente → NOT_FOUND", async () => {
    const res = await registerStockEntryAction({
      stockId: MISSING_ID,
      quantity: "1",
      movementDate: DATE,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  // ---- US2: saída + saldo nunca negativo ----
  it("saída decrementa o saldo e cria movimento adjustment", async () => {
    const res = await registerStockExitAction({
      stockId: I.epiStockA,
      quantity: "4",
      movementDate: DATE,
      type: "adjustment",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.newBalance).toBe(6); // 10 - 4
    expect(res.data.movement.type).toBe("adjustment");
    expect(await readBalance(admin, I.epiStockA)).toBe(6);
  });

  it("saída > saldo → INSUFFICIENT_STOCK e NADA gravado (rollback)", async () => {
    const res = await registerStockExitAction({
      stockId: I.epiStockA,
      quantity: "999",
      movementDate: DATE,
      type: "discard",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INSUFFICIENT_STOCK");
    // invariante: saldo e contagem de movimentos inalterados
    expect(await readBalance(admin, I.epiStockA)).toBe(10);
    expect(await countMovements(admin, I.epiStockA)).toBe(1); // só o purchase do seed
  });

  it("saída com type fora de {adjustment,discard} → VALIDATION", async () => {
    const res = await registerStockExitAction({
      stockId: I.epiStockA,
      quantity: "1",
      movementDate: DATE,
      type: "purchase" as "adjustment",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    expect(await readBalance(admin, I.epiStockA)).toBe(10);
  });

  // ---- US3: histórico com saldo resultante ----
  it("histórico ordenado (desc) com saldo resultante batendo o saldo atual", async () => {
    await registerStockEntryAction({ stockId: I.epiStockA, quantity: "5", movementDate: DATE });
    await registerStockExitAction({
      stockId: I.epiStockA,
      quantity: "3",
      movementDate: DATE,
      type: "adjustment",
    });
    // saldo agora: 10 + 5 - 3 = 12

    const res = await listStockMovementsAction(I.epiStockA, {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.total).toBe(3);
    // ordenação desc por data/created_at: a saída (mais recente) vem primeiro
    expect(res.data.rows[0].type).toBe("adjustment");
    // saldo resultante da linha mais recente == saldo atual
    expect(res.data.rows[0].runningBalance).toBe(12);
    expect(await readBalance(admin, I.epiStockA)).toBe(12);
    // a linha mais antiga (purchase do seed) tem saldo resultante 10
    expect(res.data.rows.at(-1)?.runningBalance).toBe(10);
  });

  it("item sem movimentos → histórico vazio", async () => {
    const emptyId = await freshStockNoMovements(admin);
    const res = await listStockMovementsAction(emptyId, {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.total).toBe(0);
      expect(res.data.rows).toHaveLength(0);
    }
  });

  // ---- US4: isolamento + autorização ----
  it("registrar movimento em item de outro tenant → NOT_FOUND", async () => {
    const entry = await registerStockEntryAction({
      stockId: I.epiStockB, // org_b, mas tenant ativo é org_a
      quantity: "1",
      movementDate: DATE,
    });
    expect(entry.ok).toBe(false);
    if (!entry.ok) expect(entry.error.code).toBe("NOT_FOUND");
    // saldo do item de B permanece intacto
    expect(await readBalance(admin, I.epiStockB)).toBe(5);
  });

  it("consultar histórico de item de outro tenant → NOT_FOUND", async () => {
    const res = await listStockMovementsAction(I.epiStockB, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await listStockMovementsAction(I.epiStockA, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });

  it("sem escritório ativo → bloqueado pelo gate (não vira histórico vazio)", async () => {
    mockedGate.mockRejectedValue(new NoTenantContextError());
    const res = await listStockMovementsAction(I.epiStockA, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NO_TENANT_CONTEXT");
  });
});
