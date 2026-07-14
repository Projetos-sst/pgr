/**
 * Integração do painel de pendências (read-model) contra Postgres efêmero.
 * Semeia dados VENCIDOS em org_a e prova que org_b não os vê (isolamento).
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import { getPendingItems } from "@/shared/db/repositories/pending-items";

import { adminClient, applyMigrations } from "../_helpers/db";
import { PGR_IDS, seedPgrBase } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

(shouldRun ? describe : describe.skip)("Pendências — read-model", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(async () => {
    admin = adminClient();
    await applyMigrations(admin);
    await seedPgrBase(admin);
    // Torna as pendências de org_a "vencidas"; org_b permanece em dia.
    await admin.unsafe(`
      update public.pgr set valid_until = '2020-01-01' where id = '${PGR_IDS.pgrA}';
      update public.control_measures set applicable = true, action_deadline = '2020-01-01'
        where id = '${PGR_IDS.controlMeasureA}';
      update public.epi_stock set balance = 0 where id = '${PGR_IDS.epiStockA}';
    `);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("org_a vê suas pendências vencidas", async () => {
    const p = await getPendingItems("org_a");
    expect(p.pgrsExpired).toHaveLength(1);
    expect(p.controlsOverdue).toHaveLength(1);
    expect(p.episLowStock).toHaveLength(1);
    expect(p.pgrsExpired[0].href).toBe(`/pgr/${PGR_IDS.pgrA}`);
    expect(p.controlsOverdue[0].href).toBe(`/risks/${PGR_IDS.riskA}`);
  });

  it("org_b NÃO vê as pendências de org_a (isolamento)", async () => {
    const p = await getPendingItems("org_b");
    expect(p.pgrsExpired).toHaveLength(0);
    expect(p.controlsOverdue).toHaveLength(0);
    expect(p.episLowStock).toHaveLength(0);
  });
});
