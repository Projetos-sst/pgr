/**
 * Integração do CRUD de veículos contra Postgres efêmero. CRUD + isolamento
 * multi-tenant + unicidade de placa por org.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehiclesPaginated,
  updateVehicle,
} from "@/shared/db/repositories/vehicles";
import type { VehicleValues } from "@/shared/domains/inspections/vehicles";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

function input(overrides: Partial<VehicleValues> = {}): VehicleValues {
  return {
    plate: "ABC1234",
    brand: undefined,
    model: undefined,
    type: undefined,
    color: undefined,
    owner: undefined,
    initialKm: 1000,
    photoPath: undefined,
    notes: undefined,
    ...overrides,
  };
}

(shouldRun ? describe : describe.skip)("vehicles — CRUD + isolamento", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
  });

  beforeEach(async () => {
    await seedPgrBase(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria e lista escopado ao tenant", async () => {
    await createVehicle("org_a", input());
    expect((await listVehiclesPaginated("org_a")).total).toBe(1);
    expect((await listVehiclesPaginated("org_b")).total).toBe(0);
  });

  it("cross-tenant não acessa/atualiza/deleta", async () => {
    const v = await createVehicle("org_a", input());
    expect(await getVehicle("org_b", v.id)).toBeNull();
    expect(await updateVehicle("org_b", v.id, input({ plate: "ZZZ9999" }))).toBeNull();
    expect(await deleteVehicle("org_b", v.id)).toBe(false);
    expect(await getVehicle("org_a", v.id)).not.toBeNull();
  });

  it("placa duplicada na mesma org viola unique", async () => {
    await createVehicle("org_a", input({ plate: "DUP1234" }));
    await expect(createVehicle("org_a", input({ plate: "DUP1234" }))).rejects.toThrow();
    // Mesma placa em outra org é permitida.
    await expect(
      createVehicle("org_b", input({ plate: "DUP1234" })),
    ).resolves.toBeTruthy();
  });

  it("persiste empresa/unidade/frequência; lista deriva companyName", async () => {
    await createVehicle(
      "org_a",
      input({
        plate: "CMP1A23",
        companyId: PGR_IDS.companyA,
        workUnitId: PGR_IDS.workUnitA,
        inspectionFrequency: "monthly",
        year: 2022,
        renavam: "12345678901",
      }),
    );
    const { rows } = await listVehiclesPaginated("org_a");
    const row = rows.find((r) => r.plate === "CMP1A23");
    expect(row?.companyName).toBe("A Ltda");
    expect(row?.year).toBe(2022);
    // Sem inspeção ainda → status "none".
    expect(row?.inspectionStatus).toBe("none");
  });

  it("empresa/unidade cross-tenant → ReferenceNotFoundError (FK_NOT_FOUND)", async () => {
    await expect(
      createVehicle("org_a", input({ plate: "XCT1A23", companyId: PGR_IDS.companyB })),
    ).rejects.toThrow();
    await expect(
      createVehicle("org_a", input({ plate: "XCT1A24", workUnitId: PGR_IDS.workUnitB })),
    ).rejects.toThrow();
  });

  it("filtro por empresa restringe a lista", async () => {
    await createVehicle(
      "org_a",
      input({ plate: "FIL1A23", companyId: PGR_IDS.companyA }),
    );
    await createVehicle("org_a", input({ plate: "FIL1A24" })); // sem empresa
    const filtered = await listVehiclesPaginated("org_a", {
      companyId: PGR_IDS.companyA,
    });
    expect(filtered.rows).toHaveLength(1);
    expect(filtered.rows[0].plate).toBe("FIL1A23");
  });

  it("Últ. Inspeção + Status derivam de inspeção veicular concluída", async () => {
    const v = await createVehicle(
      "org_a",
      input({ plate: "INS1A23", inspectionFrequency: "monthly" }),
    );
    // Inspeção concluída há ~2 meses → vencida (mensal).
    await admin`insert into public.inspections (org_id, type, status, inspected_at, vehicle_id)
      values ('org_a','vehicular','completed', (current_date - interval '60 days')::date, ${v.id})`;
    // Uma pendente mais recente NÃO conta (só concluídas).
    await admin`insert into public.inspections (org_id, type, status, inspected_at, vehicle_id)
      values ('org_a','vehicular','pending', current_date, ${v.id})`;
    const { rows } = await listVehiclesPaginated("org_a");
    const row = rows.find((r) => r.plate === "INS1A23");
    expect(row?.lastInspectedAt).not.toBeNull();
    expect(row?.inspectionStatus).toBe("expired");
  });
});
