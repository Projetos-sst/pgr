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
} from "@/shared/server/actions/pgr/epi-deliveries";
import { getEmployeeEpiRecordAction } from "@/shared/server/actions/pgr/epi-record";

import { adminClient, applyMigrations } from "./_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "./_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const OLD_DATE = "2026-01-10";
const NEW_DATE = "2026-07-01";

const mockedGate = requireOfficeStaff as jest.MockedFunction<typeof requireOfficeStaff>;
const asOwner = (tenantId: string) =>
  mockedGate.mockResolvedValue({ userId: "u", tenantId, plan: "free", role: "owner" });

(shouldRun ? describe : describe.skip)("Ficha de EPI do funcionário (012/US5)", () => {
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

  // duas entregas em datas distintas; a mais antiga é devolvida
  async function seedTwoDeliveries(): Promise<void> {
    const older = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: OLD_DATE,
      items: [{ stockId: I.epiStockA, quantity: 2 }],
    });
    if (!older.ok) throw new Error("setup failed");
    const [oldItem] = await admin<{ id: string }[]>`
      select id from public.epi_delivery_items where delivery_id = ${older.data.id}`;
    await returnDeliveryItemAction(older.data.id, { itemId: oldItem.id });

    const newer = await createDeliveryAction({
      employeeId: I.employeeA,
      deliveryDate: NEW_DATE,
      items: [{ stockId: I.epiStockA, quantity: 3 }],
    });
    if (!newer.ok) throw new Error("setup failed");
  }

  it("lista as entregas do funcionário em delivery_date DESC com colunas da ficha", async () => {
    await seedTwoDeliveries();
    const res = await getEmployeeEpiRecordAction(I.employeeA);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // 2 criadas aqui + 1 do seed (sem delivery_date explícita = hoje)
    expect(res.data.total).toBe(3);
    const dates = res.data.rows.map((r) => r.deliveryDate);
    expect([...dates].sort().reverse()).toEqual(dates); // DESC

    const returned = res.data.rows.find((r) => r.deliveryDate === OLD_DATE);
    expect(returned?.returnedAt).not.toBeNull();
    expect(returned?.quantity).toBe(2);
    expect(returned?.epiName).toBe("Capacete CA-123");
    expect(returned?.signatureLabel).toBe("Pendente de assinatura");
  });

  it("filtros de status e período retornam o subconjunto correto", async () => {
    await seedTwoDeliveries();

    const devolvidos = await getEmployeeEpiRecordAction(I.employeeA, {
      status: "devolvido",
    });
    expect(devolvidos.ok).toBe(true);
    if (devolvidos.ok) {
      expect(devolvidos.data.total).toBe(1);
      expect(devolvidos.data.rows[0].deliveryDate).toBe(OLD_DATE);
    }

    const pendentes = await getEmployeeEpiRecordAction(I.employeeA, {
      status: "pendente",
    });
    expect(pendentes.ok).toBe(true);
    if (pendentes.ok) {
      expect(pendentes.data.total).toBe(2);
      expect(pendentes.data.rows.every((r) => r.returnedAt === null)).toBe(true);
    }

    const periodo = await getEmployeeEpiRecordAction(I.employeeA, {
      from: "2026-06-01",
      to: "2026-07-02",
    });
    expect(periodo.ok).toBe(true);
    if (periodo.ok) {
      expect(periodo.data.total).toBe(1);
      expect(periodo.data.rows[0].deliveryDate).toBe(NEW_DATE);
    }
  });

  it("ficha não cruza tenant: funcionário de outra org → NOT_FOUND", async () => {
    const res = await getEmployeeEpiRecordAction(I.employeeB);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  it("funcionário sem entregas → { rows: [], total: 0 }", async () => {
    await admin.unsafe(
      `delete from public.epi_deliveries where employee_id = '${I.employeeA}'`,
    );
    const res = await getEmployeeEpiRecordAction(I.employeeA);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rows).toEqual([]);
      expect(res.data.total).toBe(0);
    }
  });

  it("papel client → FORBIDDEN", async () => {
    mockedGate.mockRejectedValue(new ForbiddenError());
    const res = await getEmployeeEpiRecordAction(I.employeeA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });
});
