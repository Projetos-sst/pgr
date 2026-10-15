/**
 * Integração do modelo de inspeções (fatia 034) contra Postgres efêmero.
 * Semeia veículo/plano/inspeção em org_a e org_b e prova o isolamento
 * multi-tenant (org_a nunca vê os dados de org_b).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  getInspectionById,
  getVehicleById,
  listInspectionPlans,
  listInspections,
  listVehicles,
} from "@/shared/db/repositories/inspections";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const VEH_A = "aaaaaaaa-0000-0000-0000-0000000000a1";
const VEH_B = "bbbbbbbb-0000-0000-0000-0000000000b1";
const PLAN_A = "aaaaaaaa-0000-0000-0000-0000000000a2";
const PLAN_B = "bbbbbbbb-0000-0000-0000-0000000000b2";
const INSP_A = "aaaaaaaa-0000-0000-0000-0000000000a3";
const INSP_B = "bbbbbbbb-0000-0000-0000-0000000000b3";

(shouldRun ? describe : describe.skip)("inspeções — isolamento multi-tenant", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
    await admin.unsafe(`
      insert into public.vehicles (id, org_id, plate) values
        ('${VEH_A}','org_a','ABC1D23'), ('${VEH_B}','org_b','XYZ9K88');
      insert into public.inspection_plans (id, org_id, number, type, title) values
        ('${PLAN_A}','org_a',1,'vehicular','Plano A'),
        ('${PLAN_B}','org_b',1,'equipment','Plano B');
      insert into public.inspections (id, org_id, type, inspected_at, vehicle_id, plan_id) values
        ('${INSP_A}','org_a','vehicular','2026-07-01','${VEH_A}','${PLAN_A}'),
        ('${INSP_B}','org_b','equipment','2026-07-01',null,'${PLAN_B}');
    `);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("listagens retornam só o tenant ativo", async () => {
    expect((await listVehicles("org_a")).total).toBe(1);
    expect((await listVehicles("org_b")).total).toBe(1);
    expect((await listInspectionPlans("org_a")).rows[0].title).toBe("Plano A");
    expect((await listInspections("org_a")).total).toBe(1);
  });

  it("getById cross-tenant → null (não vaza)", async () => {
    expect(await getVehicleById("org_a", VEH_B)).toBeNull();
    expect(await getInspectionById("org_a", INSP_B)).toBeNull();
    // Continua acessível para o dono.
    expect(await getVehicleById("org_b", VEH_B)).not.toBeNull();
  });

  it("filtro por tipo de inspeção", async () => {
    expect((await listInspections("org_a", { type: "vehicular" })).total).toBe(1);
    expect((await listInspections("org_a", { type: "equipment" })).total).toBe(0);
  });
});
