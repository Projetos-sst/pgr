/**
 * Integração das contagens de KPI do dashboard contra Postgres efêmero.
 * Prova (Princípio I / FR-009 / SC-005) que cada contagem só enxerga o próprio
 * `org_id`: com dois tenants semeados, a contagem de um nunca inclui o outro.
 */
import type postgres from "postgres";

jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));

import { getDashboardKpis } from "@/shared/server/dashboard/kpis";
import { countEpiStockBelowMinimum } from "@/shared/db/repositories/epi-stock";

import { adminClient, applyMigrations } from "../_helpers/db";
import { seedPgrBase, PGR_IDS } from "../_helpers/pgr-seed";

const APP_RUNTIME_URL = process.env.INTEGRATION_APP_RUNTIME_URL;
const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!APP_RUNTIME_URL && !!ADMIN_URL;

(shouldRun ? describe : describe.skip)(
  "dashboard KPIs — isolamento por tenant (US4)",
  () => {
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
    });

    it("conta apenas os registros do próprio org_a", async () => {
      const kpis = await getDashboardKpis("org_a");
      // O seed insere exatamente 1 empresa, 1 PGR e 1 funcionário por tenant.
      expect(kpis.companies).toBe(1);
      expect(kpis.pgrs).toBe(1);
      expect(kpis.employees).toBe(1);
    });

    it("não vaza as contagens do org_b para o org_a (e vice-versa)", async () => {
      // Segundo funcionário e empresa em org_b: o org_a deve permanecer em 1.
      await admin.unsafe(`
      insert into public.companies (id, org_id, cnpj, razao_social) values
        ('33333333-3333-3333-3333-333333333333','org_b','33333333000133','B2 Ltda');
      insert into public.employees (id, org_id, company_id, full_name, cpf) values
        ('33333333-3333-3333-3333-3333333333c4','org_b','${PGR_IDS.companyB}','Func B2','55544433322');
    `);

      const orgA = await getDashboardKpis("org_a");
      const orgB = await getDashboardKpis("org_b");

      expect(orgA.companies).toBe(1);
      expect(orgA.employees).toBe(1);
      expect(orgB.companies).toBe(2);
      expect(orgB.employees).toBe(2);
    });

    it("EPIs abaixo da mínima: conta o item de org_a e ignora o de org_b", async () => {
      // Seed: stock A (balance 10, min 2) e stock B (balance 5, min 1) — ambos ok.
      // Rebaixa só o de org_a para abaixo da mínima.
      await admin.unsafe(
        `update public.epi_stock set balance = 1, min_quantity = 2 where id = '${PGR_IDS.epiStockA}';`,
      );

      expect(await countEpiStockBelowMinimum("org_a")).toBe(1);
      expect(await countEpiStockBelowMinimum("org_b")).toBe(0);

      // Agora rebaixa também o de org_b: cada contagem enxerga só o seu.
      await admin.unsafe(
        `update public.epi_stock set balance = 0, min_quantity = 3 where id = '${PGR_IDS.epiStockB}';`,
      );

      expect(await countEpiStockBelowMinimum("org_a")).toBe(1);
      expect(await countEpiStockBelowMinimum("org_b")).toBe(1);
    });
  },
);
