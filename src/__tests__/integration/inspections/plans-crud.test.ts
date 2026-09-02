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

  it("gera código sequencial por tenant e persiste status/frequência/categoria", async () => {
    const a = await createPlan("org_a", {
      type: "vehicular",
      subtype: "Trabalho em Altura",
      title: "Andaimes",
      frequency: "biweekly",
      status: "draft",
      items: [],
    });
    const b = await createPlan("org_a", {
      type: "vehicular",
      title: "Outro",
      items: [],
    });
    const pa = await getPlanWithItems("org_a", a.id);
    const pb = await getPlanWithItems("org_a", b.id);
    expect(pb!.plan.number).toBe(pa!.plan.number + 1); // consecutivos
    expect(pa!.plan.frequency).toBe("biweekly");
    expect(pa!.plan.status).toBe("draft");
    expect(pb!.plan.status).toBe("active"); // default quando omitido

    const c = await createPlan("org_b", { type: "vehicular", title: "B1", items: [] });
    const pc = await getPlanWithItems("org_b", c.id);
    expect(pc!.plan.number).toBeGreaterThanOrEqual(1);
  });

  it("filtra por status e por categoria (subtype)", async () => {
    await createPlan("org_a", {
      type: "equipment",
      subtype: "NR-12 Filtro",
      title: "Prensa",
      status: "inactive",
      items: [],
    });
    const byStatus = await listPlans("org_a", { status: "inactive" });
    expect(byStatus.rows.every((r) => r.status === "inactive")).toBe(true);
    expect(byStatus.rows.some((r) => r.title === "Prensa")).toBe(true);

    const byCat = await listPlans("org_a", { category: "NR-12 Filtro" });
    expect(byCat.rows).toHaveLength(1);
    expect(byCat.rows[0].title).toBe("Prensa");
    expect(byCat.rows[0].code).toMatch(/^PI-\d{4}$/);
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
