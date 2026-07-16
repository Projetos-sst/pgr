/**
 * Integração do fluxo de inspeção de equipamento (fatia 038) contra Postgres
 * efêmero. Cobre create (equipamento machine + plano equipment), FK_NOT_FOUND
 * (tipo errado / cross-tenant), checklist → completed e isolamento.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  createEquipmentInspection,
  deleteEquipmentInspection,
  getEquipmentInspection,
  listEquipmentInspections,
  saveEquipmentChecklist,
} from "@/shared/db/repositories/equipment-inspections";
import { createPlan } from "@/shared/db/repositories/inspection-plans";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

// Categoria/equipamento machine para org_a (o seed só tem machine em org_b).
const CAT_MACHINE_A = "aaaaaaaa-2222-4000-8000-0000000000a5";
const EQUIP_A = "aaaaaaaa-2222-4000-8000-0000000000a7";
const EPI_A = "11111111-1111-1111-1111-1111111111a7"; // epiCatalogA (tipo epi)

(shouldRun ? describe : describe.skip)("inspeção de equipamento — fluxo", () => {
  let admin: ReturnType<typeof postgres>;
  let planEquip = "";

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
    await admin.unsafe(`
      insert into public.categories (id, org_id, type, name) values
        ('${CAT_MACHINE_A}','org_a','machine','Betoneira A') on conflict do nothing;
      insert into public.epi_catalog (id, org_id, type, category_id, name) values
        ('${EQUIP_A}','org_a','machine','${CAT_MACHINE_A}','Betoneira 250L') on conflict do nothing;
    `);
    const plan = await createPlan("org_a", {
      type: "equipment",
      title: "Checklist equip flow",
      items: [
        { description: "Nível de óleo", defaultValue: true },
        { description: "Proteções", defaultValue: false },
      ],
    });
    planEquip = plan.id;
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria cabeçalho (in_progress) e lê itens do plano", async () => {
    const created = await createEquipmentInspection("org_a", {
      equipmentCatalogId: EQUIP_A,
      planId: planEquip,
      inspectedAt: "2026-07-15",
      responsible: "Marcos",
    });
    expect(created).not.toBeNull();
    const detail = await getEquipmentInspection("org_a", created!.id);
    expect(detail!.inspection.status).toBe("in_progress");
    expect(detail!.equipment?.name).toBe("Betoneira 250L");
    expect(detail!.items).toHaveLength(2);
  });

  it("equipamento tipo epi (não machine) → null (FK_NOT_FOUND)", async () => {
    const created = await createEquipmentInspection("org_a", {
      equipmentCatalogId: EPI_A, // existe, mas é tipo 'epi'
      planId: planEquip,
      inspectedAt: "2026-07-15",
    });
    expect(created).toBeNull();
  });

  it("plano veicular em inspeção de equipamento → null", async () => {
    const vehicularPlan = await createPlan("org_a", {
      type: "vehicular",
      title: "Plano veicular",
      items: [],
    });
    const created = await createEquipmentInspection("org_a", {
      equipmentCatalogId: EQUIP_A,
      planId: vehicularPlan.id,
      inspectedAt: "2026-07-15",
    });
    expect(created).toBeNull();
  });

  it("salva checklist → completed", async () => {
    const created = await createEquipmentInspection("org_a", {
      equipmentCatalogId: EQUIP_A,
      planId: planEquip,
      inspectedAt: "2026-07-15",
    });
    const before = await getEquipmentInspection("org_a", created!.id);
    const ok = await saveEquipmentChecklist("org_a", created!.id, {
      responses: before!.items.map((it, i) => ({
        planItemId: it.planItemId,
        value: i === 0 ? true : false,
        observation: "",
      })),
    });
    expect(ok).toBe(true);
    const after = await getEquipmentInspection("org_a", created!.id);
    expect(after!.inspection.status).toBe("completed");
    expect(after!.items[0].value).toBe(true);
  });

  it("listagem só de equipamentos + isolamento cross-tenant", async () => {
    const listed = await listEquipmentInspections("org_a");
    expect(listed.total).toBeGreaterThan(0);
    const created = await createEquipmentInspection("org_a", {
      equipmentCatalogId: EQUIP_A,
      planId: planEquip,
      inspectedAt: "2026-07-15",
    });
    expect(await getEquipmentInspection("org_b", created!.id)).toBeNull();
    expect(await deleteEquipmentInspection("org_b", created!.id)).toBe(false);
    expect(await deleteEquipmentInspection("org_a", created!.id)).toBe(true);
  });
});
