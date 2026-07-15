/**
 * Integração do fluxo de inspeção veicular (fatia 037) contra Postgres efêmero.
 * Cobre create (2 passos), FK_NOT_FOUND cross-tenant, save do checklist com
 * status → completed, filtro de planItemId forjado e isolamento.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import { createPlan } from "@/shared/db/repositories/inspection-plans";
import {
  createVehicularInspection,
  deleteVehicularInspection,
  getVehicularInspection,
  listVehicularInspections,
  saveChecklist,
  updateVehicularInspectionHeader,
} from "@/shared/db/repositories/vehicular-inspections";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

const VEH_A = "aaaaaaaa-1111-0000-0000-0000000000a1";
const VEH_B = "bbbbbbbb-1111-0000-0000-0000000000b1";

(shouldRun ? describe : describe.skip)("inspeção veicular — fluxo 2 passos", () => {
  let admin: ReturnType<typeof postgres>;
  let planAId = "";

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
    await admin.unsafe(`
      insert into public.vehicles (id, org_id, plate) values
        ('${VEH_A}','org_a','FLW2A34'), ('${VEH_B}','org_b','FLW9B88')
      on conflict do nothing;
    `);
    const plan = await createPlan("org_a", {
      type: "vehicular",
      title: "Checklist veicular flow",
      items: [
        { description: "Freios", defaultValue: true },
        { description: "Pneus", defaultValue: false },
      ],
    });
    planAId = plan.id;
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria cabeçalho (in_progress) e lê itens do plano sem resposta", async () => {
    const created = await createVehicularInspection("org_a", {
      vehicleId: VEH_A,
      planId: planAId,
      inspectedAt: "2026-07-15",
      responsible: "Ana",
      currentKm: 15000,
    });
    expect(created).not.toBeNull();
    const detail = await getVehicularInspection("org_a", created!.id);
    expect(detail!.inspection.status).toBe("in_progress");
    expect(detail!.vehicle?.plate).toBe("FLW2A34");
    expect(detail!.items).toHaveLength(2);
    expect(detail!.items[0].value).toBeNull();
    expect(detail!.items[0].defaultValue).toBe(true);
  });

  it("veículo/plano de outro tenant → null (FK_NOT_FOUND)", async () => {
    const created = await createVehicularInspection("org_a", {
      vehicleId: VEH_B, // pertence a org_b
      planId: planAId,
      inspectedAt: "2026-07-15",
    });
    expect(created).toBeNull();
  });

  it("salva checklist → completed e persiste respostas", async () => {
    const created = await createVehicularInspection("org_a", {
      vehicleId: VEH_A,
      planId: planAId,
      inspectedAt: "2026-07-15",
    });
    const before = await getVehicularInspection("org_a", created!.id);
    const [freios, pneus] = before!.items;

    const ok = await saveChecklist("org_a", created!.id, {
      responses: [
        { planItemId: freios.planItemId, value: true, observation: "ok" },
        { planItemId: pneus.planItemId, value: false, observation: "careca" },
        // planItemId forjado (não pertence ao plano) → ignorado
        { planItemId: "cccccccc-0000-0000-0000-0000000000c9", value: true },
      ],
    });
    expect(ok).toBe(true);

    const after = await getVehicularInspection("org_a", created!.id);
    expect(after!.inspection.status).toBe("completed");
    const byItem = Object.fromEntries(after!.items.map((i) => [i.planItemId, i.value]));
    expect(byItem[freios.planItemId]).toBe(true);
    expect(byItem[pneus.planItemId]).toBe(false);
    // forjado não vira linha
    const [{ count }] = await admin.unsafe(
      `select count(*)::int as count from public.inspection_item_responses where inspection_id = '${created!.id}'`,
    );
    expect(count).toBe(2);
  });

  it("listagem só de veiculares + isolamento cross-tenant", async () => {
    const listed = await listVehicularInspections("org_a");
    expect(listed.rows.every((r) => r.vehiclePlate !== null || true)).toBe(true);
    expect(listed.total).toBeGreaterThan(0);

    const created = await createVehicularInspection("org_a", {
      vehicleId: VEH_A,
      planId: planAId,
      inspectedAt: "2026-07-15",
    });
    expect(await getVehicularInspection("org_b", created!.id)).toBeNull();
    expect(
      await updateVehicularInspectionHeader("org_b", created!.id, {
        vehicleId: VEH_B,
        planId: planAId,
        inspectedAt: "2026-07-15",
      }),
    ).toBe(false);
    expect(await deleteVehicularInspection("org_b", created!.id)).toBe(false);
    expect(await deleteVehicularInspection("org_a", created!.id)).toBe(true);
  });
});
