/**
 * Integração do CRUD de planos de inspeção + itens (fatia 036) contra
 * Postgres efêmero. Cobre create/get/update/delete, substituição de itens
 * (delete-then-insert), busca/paginação e isolamento cross-tenant.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import {
  createPlan,
  deletePlan,
  getPlanWithItems,
  listPlans,
  updatePlan,
} from "@/shared/db/repositories/inspection-plans";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

(shouldRun ? describe : describe.skip)("planos de inspeção — CRUD + itens", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("cria plano com itens e lê de volta na ordem", async () => {
    const { id } = await createPlan("org_a", {
      type: "vehicular",
      subtype: "Caminhão",
      title: "Checklist frota",
      description: "Diário",
      items: [
        { description: "Freios", defaultValue: true },
        { description: "Pneus", defaultValue: false },
        { description: "Luzes", defaultValue: false },
      ],
    });

    const found = await getPlanWithItems("org_a", id);
    expect(found).not.toBeNull();
    expect(found!.plan.title).toBe("Checklist frota");
    expect(found!.items.map((i) => i.description)).toEqual(["Freios", "Pneus", "Luzes"]);
    expect(found!.items[0].defaultValue).toBe(true);
    expect(found!.items.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it("update substitui os itens (delete-then-insert)", async () => {
    const { id } = await createPlan("org_a", {
      type: "equipment",
      title: "Plano equip",
      items: [{ description: "Item antigo", defaultValue: false }],
    });

    const ok = await updatePlan("org_a", id, {
      type: "equipment",
      title: "Plano equip v2",
      items: [
        { description: "Novo A", defaultValue: false },
        { description: "Novo B", defaultValue: true },
      ],
    });
    expect(ok).toBe(true);

    const found = await getPlanWithItems("org_a", id);
    expect(found!.plan.title).toBe("Plano equip v2");
    expect(found!.items.map((i) => i.description)).toEqual(["Novo A", "Novo B"]);
  });

  it("busca por título, filtro por tipo e itemCount", async () => {
    const { id } = await createPlan("org_a", {
      type: "vehicular",
      title: "Busca frota XYZ",
      items: [
        { description: "A", defaultValue: false },
        { description: "B", defaultValue: false },
      ],
    });

    const search = await listPlans("org_a", { search: "frota XYZ" });
    const mine = search.rows.find((r) => r.id === id);
    expect(mine).toBeDefined();
    expect(mine!.itemCount).toBe(2);

    const vehicular = await listPlans("org_a", {
      type: "vehicular",
      search: "frota XYZ",
    });
    expect(vehicular.rows.every((r) => r.type === "vehicular")).toBe(true);
    expect(vehicular.rows.some((r) => r.id === id)).toBe(true);
  });

  it("delete remove o plano e cascateia itens", async () => {
    const { id } = await createPlan("org_a", {
      type: "vehicular",
      title: "Descartável",
      items: [{ description: "X", defaultValue: false }],
    });
    expect(await deletePlan("org_a", id)).toBe(true);
    expect(await getPlanWithItems("org_a", id)).toBeNull();
    // itens somem por cascade
    const [{ count }] = await admin.unsafe(
      `select count(*)::int as count from public.inspection_plan_items where plan_id = '${id}'`,
    );
    expect(count).toBe(0);
  });

  it("isolamento cross-tenant: org_b não enxerga plano de org_a", async () => {
    const { id } = await createPlan("org_a", {
      type: "vehicular",
      title: "Só de A",
      items: [],
    });
    expect(await getPlanWithItems("org_b", id)).toBeNull();
    expect(
      await updatePlan("org_b", id, { type: "vehicular", title: "hack", items: [] }),
    ).toBe(false);
    expect(await deletePlan("org_b", id)).toBe(false);
    // dono continua vendo
    expect(await getPlanWithItems("org_a", id)).not.toBeNull();
  });
});
