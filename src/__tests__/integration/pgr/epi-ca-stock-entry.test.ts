import type postgres from "postgres";
import { NextRequest } from "next/server";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({
  OFFICE_STAFF_ROLES: new Set(["owner", "collaborator"]),
  requireOfficeStaff: jest.fn(),
}));

import { POST as POST_MOVEMENT } from "@/app/api/v1/epi-stock/[id]/movements/route";
import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  createDeliveryAction,
  returnDeliveryItemAction,
} from "@/shared/server/actions/pgr/epi-deliveries";
import { createEpiStockAction } from "@/shared/server/actions/pgr/epi-stock";
import {
  listStockMovementsAction,
  registerStockEntryAction,
  registerStockExitAction,
} from "@/shared/server/actions/pgr/stock-movements";

import { ACCESS_IDS as X, seedAccessScopeFixtures } from "../_helpers/access-scope-seed";
import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../_helpers/pgr-seed";

const shouldRun =
  !!process.env.INTEGRATION_APP_RUNTIME_URL && !!process.env.INTEGRATION_DATABASE_URL;

type Admin = ReturnType<typeof postgres>;

function shiftDays(civil: string, days: number): string {
  const date = new Date(`${civil}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const TODAY = todayInSaoPaulo();
const YESTERDAY = shiftDays(TODAY, -1);
const TOMORROW = shiftDays(TODAY, 1);
const EXPIRED = { ok: false, error: { code: "VALIDATION" } };

const mockedGate = jest.mocked(requireOfficeStaff);
const asOwner = (tenantId: string, userId = "u") =>
  mockedGate.mockResolvedValue({ userId, tenantId, plan: "free", role: "owner" });
const asCollaborator = (userId: string) =>
  mockedGate.mockResolvedValue({
    userId,
    tenantId: "org_a",
    plan: "free",
    role: "collaborator",
  });

async function setCa(
  admin: Admin,
  ca: string | null,
  caValidUntil: string | null,
): Promise<void> {
  await admin`update public.epi_catalog set ca = ${ca}, ca_valid_until = ${caValidUntil}
    where id = ${I.epiCatalogA}`;
}

async function stockState(
  admin: Admin,
  stockId: string,
): Promise<{ balance: number; movements: number }> {
  const [row] = await admin<{ balance: number; movements: number }[]>`
    select s.balance, (select count(*)::int from public.stock_movements m
      where m.stock_id = s.id) as movements
    from public.epi_stock s where s.id = ${stockId}`;
  return row;
}

async function freshCatalog(admin: Admin, caValidUntil: string | null): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into public.epi_catalog (org_id, type, category_id, name, ca, ca_valid_until)
    values ('org_a', 'epi', ${I.categoryA}, 'Luva nova', '777', ${caValidUntil})
    returning id`;
  return row.id;
}

function entry(movementDate = TODAY) {
  return registerStockEntryAction({
    stockId: I.epiStockA,
    quantity: "3",
    movementDate,
    batch: "LOTE-180",
  });
}

function restEntry(tenant: string, stockId: string) {
  const request = new NextRequest(
    `http://localhost/api/v1/epi-stock/${stockId}/movements`,
    {
      method: "POST",
      body: JSON.stringify({ kind: "entry", quantity: 3, movementDate: TODAY }),
      headers: {
        "content-type": "application/json",
        "x-dev-tenant": tenant,
        "x-dev-role": "owner",
      },
    },
  );
  return POST_MOVEMENT(request, { params: Promise.resolve({ id: stockId }) });
}

(shouldRun ? describe : describe.skip)("NOB-180 — entrada de EPI com CA vencido", () => {
  let admin: Admin;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    process.env.APP_ENV = "local";
    process.env.DEV_API_AUTH_BYPASS = "true";
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await seedPgrBase(admin);
    mockedGate.mockReset();
    asOwner("org_a");
  });

  it("CA válido até amanhã: a entrada soma ao saldo e grava o lote", async () => {
    await setCa(admin, "123", TOMORROW);
    expect(await entry()).toMatchObject({ ok: true, data: { newBalance: 13 } });
    const history = await listStockMovementsAction(I.epiStockA, {});
    expect(history).toMatchObject({
      ok: true,
      data: { rows: [{ type: "purchase", batch: "LOTE-180", runningBalance: 13 }, {}] },
    });
  });

  it("CA que vence hoje: a entrada ainda é aceita (dia D inclusive)", async () => {
    await setCa(admin, "123", TODAY);
    expect(await entry()).toMatchObject({ ok: true, data: { newBalance: 13 } });
  });

  it("CA vencido ontem: a entrada é recusada com o motivo e nada é gravado", async () => {
    await setCa(admin, "123", YESTERDAY);
    expect(await entry()).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", message: expect.stringContaining("CA 123 vencido") },
    });
    expect(await stockState(admin, I.epiStockA)).toEqual({ balance: 10, movements: 1 });
  });

  it("data do movimento anterior ao vencimento não libera a entrada: vale a data de hoje", async () => {
    await setCa(admin, "123", YESTERDAY);
    expect(await entry(shiftDays(TODAY, -30))).toMatchObject(EXPIRED);
    expect(await stockState(admin, I.epiStockA)).toEqual({ balance: 10, movements: 1 });
  });

  it("EPI sem validade do CA: a entrada é recusada pedindo o CA e a validade", async () => {
    await setCa(admin, "123", null);
    expect(await entry()).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", message: expect.stringContaining("Informe o CA") },
    });
    await setCa(admin, null, TOMORROW);
    expect(await entry()).toMatchObject(EXPIRED);
    expect(await stockState(admin, I.epiStockA)).toEqual({ balance: 10, movements: 1 });
  });

  it("estoque já existente cujo CA venceu depois: saldo preservado, entrega, baixa e devolução seguem permitidas", async () => {
    await setCa(admin, "123", YESTERDAY);
    expect(await stockState(admin, I.epiStockA)).toEqual({ balance: 10, movements: 1 });

    const delivery = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: TODAY,
      items: [{ stockId: I.epiStockA, quantity: "2" }],
    });
    expect(delivery).toMatchObject({ ok: true, data: { items: [{ newBalance: 8 }] } });
    if (!delivery.ok) return;

    const exit = await registerStockExitAction({
      stockId: I.epiStockA,
      quantity: "1",
      movementDate: TODAY,
      type: "discard",
    });
    expect(exit).toMatchObject({ ok: true, data: { newBalance: 7 } });

    const [item] = await admin<{ id: string }[]>`
      select id from public.epi_delivery_items where delivery_id = ${delivery.data.id}`;
    const returned = await returnDeliveryItemAction(delivery.data.id, {
      itemId: item.id,
    });
    expect(returned).toMatchObject({ ok: true, data: { newBalance: 9 } });
  });

  it("saldo inicial de item novo com CA vencido: recusa e não cria a linha de estoque", async () => {
    const catalogId = await freshCatalog(admin, YESTERDAY);
    const created = await createEpiStockAction({
      catalogId,
      minimumQuantity: "0",
      initialQuantity: "5",
    });
    expect(created).toMatchObject(EXPIRED);
    const rows =
      await admin`select id from public.epi_stock where catalog_id = ${catalogId}`;
    expect(rows).toHaveLength(0);
  });

  it("item novo com CA vencido pode ser associado ao estoque sem saldo inicial", async () => {
    const catalogId = await freshCatalog(admin, YESTERDAY);
    const created = await createEpiStockAction({ catalogId, minimumQuantity: "0" });
    expect(created).toMatchObject({ ok: true, data: { balance: 0 } });
  });

  it("REST aplica a mesma regra: 201 com CA válido e 422 com CA vencido", async () => {
    await setCa(admin, "123", TODAY);
    expect((await restEntry("org_a", I.epiStockA)).status).toBe(201);

    await setCa(admin, "123", YESTERDAY);
    const refused = await restEntry("org_a", I.epiStockA);
    expect(refused.status).toBe(422);
    expect(JSON.stringify(await refused.json())).toContain("CA 123 vencido");
    expect(await stockState(admin, I.epiStockA)).toEqual({ balance: 13, movements: 2 });
  });

  it("outro escritório: não alcança o estoque alheio e não é afetado pelo CA dele", async () => {
    await setCa(admin, "123", TOMORROW);
    asOwner("org_b");
    expect(await entry()).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect((await restEntry("org_b", I.epiStockA)).status).toBe(404);
    expect(await stockState(admin, I.epiStockA)).toEqual({ balance: 10, movements: 1 });

    await setCa(admin, "123", YESTERDAY);
    expect((await restEntry("org_b", I.epiStockB)).status).toBe(201);
  });

  it("outra empresa: membro restrito a outra empresa não registra entrada no EPI desta", async () => {
    await seedAccessScopeFixtures(admin);
    await setCa(admin, "123", TOMORROW);
    await admin`update public.epi_catalog set company_id = ${I.companyA}
      where id = ${I.epiCatalogA}`;
    await admin`insert into public.member_access_scopes
      (org_id, user_id, company_id, area, granted_by)
      values ('org_a', ${X.scoped}, ${X.companyA2}, 'safety', ${X.owner})`;

    asCollaborator(X.scoped);
    expect(await entry()).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await stockState(admin, I.epiStockA)).toEqual({ balance: 10, movements: 1 });

    asOwner("org_a", X.owner);
    expect(await entry()).toMatchObject({ ok: true, data: { newBalance: 13 } });
  });
});
