import postgres from "postgres";

import { adminClient, applyMigrations } from "../../_helpers/db";
import { seedPgrBase, PGR_IDS as I } from "../../_helpers/pgr-seed";

const ADMIN_URL = process.env.INTEGRATION_DATABASE_URL;
const shouldRun = !!ADMIN_URL;

(shouldRun ? describe : describe.skip)(
  "EPI — unicidade, CHECK e enums do modelo de EPIs",
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

    it("CHECK (quantity > 0): movimento com quantidade <= 0 é rejeitado", async () => {
      await expect(
        admin`insert into public.stock_movements (org_id, stock_id, type, quantity)
              values ('org_a', ${I.epiStockA}, 'purchase', 0)`,
      ).rejects.toThrow();
      await expect(
        admin`insert into public.stock_movements (org_id, stock_id, type, quantity)
              values ('org_a', ${I.epiStockA}, 'adjustment', -5)`,
      ).rejects.toThrow();
    });

    it("CHECK (quantity > 0): item de entrega com quantidade <= 0 é rejeitado", async () => {
      await expect(
        admin`insert into public.epi_delivery_items (org_id, delivery_id, catalog_id, quantity)
              values ('org_a', ${I.epiDeliveryA}, ${I.epiCatalogA}, 0)`,
      ).rejects.toThrow();
    });

    it("CHECK (balance/min_quantity >= 0): saldo negativo é rejeitado", async () => {
      await expect(
        admin`update public.epi_stock set balance = -1 where id = ${I.epiStockA}`,
      ).rejects.toThrow();
      await expect(
        admin`update public.epi_stock set min_quantity = -1 where id = ${I.epiStockA}`,
      ).rejects.toThrow();
    });

    it("UNIQUE(org_id, catalog_id) em epi_stock: um estoque por item na org", async () => {
      await expect(
        admin`insert into public.epi_stock (org_id, catalog_id, balance, min_quantity)
              values ('org_a', ${I.epiCatalogA}, 0, 0)`,
      ).rejects.toThrow();
    });

    it("UNIQUE(org_id, catalog_id, risk_id) em epi_risk: vínculo não duplica", async () => {
      await expect(
        admin`insert into public.epi_risk (org_id, catalog_id, risk_id, neutralization)
              values ('org_a', ${I.epiCatalogA}, ${I.riskA}, 'neutralizes')`,
      ).rejects.toThrow();
    });

    it("UNIQUE parcial de auth_token: token duplicado é rejeitado; múltiplos NULL coexistem", async () => {
      await admin`update public.epi_deliveries set auth_token = 'tok-1' where id = ${I.epiDeliveryA}`;
      await expect(
        admin`insert into public.epi_deliveries (org_id, employee_id, auth_token)
              values ('org_a', ${I.employeeA}, 'tok-1')`,
      ).rejects.toThrow();
      // dois registros com auth_token NULL coexistem (índice é parcial)
      await expect(
        admin`insert into public.epi_deliveries (org_id, employee_id)
              values ('org_a', ${I.employeeA}), ('org_a', ${I.employeeA})`,
      ).resolves.toBeDefined();
    });

    it("enum stock_movement_type fechado: valor fora do conjunto é rejeitado", async () => {
      await expect(
        admin.unsafe(
          `insert into public.stock_movements (org_id, stock_id, type, quantity)
           values ('org_a', '${I.epiStockA}', 'loan', 1)`,
        ),
      ).rejects.toThrow();
    });

    it("enum epi_signature_status fechado: valor fora do conjunto é rejeitado", async () => {
      await expect(
        admin.unsafe(
          `update public.epi_deliveries set signature_status = 'signed_voice'
           where id = '${I.epiDeliveryA}'`,
        ),
      ).rejects.toThrow();
    });

    it("FK epi_catalog.category_id ON DELETE RESTRICT: não exclui categoria em uso", async () => {
      await expect(
        admin`delete from public.categories where id = ${I.categoryA}`,
      ).rejects.toThrow();
    });

    it("FR-002a: item com type != categoria é rejeitado; type == categoria é aceito", async () => {
      // categoryA é do tipo 'epi'. Inserir item 'machine' apontando p/ ela viola a FK composta
      // (category_id, type) -> categories(id, type).
      await expect(
        admin`insert into public.epi_catalog (org_id, type, category_id, name)
              values ('org_a', 'machine', ${I.categoryA}, 'Item tipo errado')`,
      ).rejects.toThrow();
      // caminho feliz: mesmo tipo da categoria é aceito.
      await expect(
        admin`insert into public.epi_catalog (org_id, type, category_id, name)
              values ('org_a', 'epi', ${I.categoryA}, 'Item tipo certo')`,
      ).resolves.toBeDefined();
    });

    it("ON DELETE CASCADE: excluir item do catálogo remove o estoque vinculado", async () => {
      // item novo sem entregas (epi_delivery_items é RESTRICT), só com estoque
      const [cat] = await admin<{ id: string }[]>`
        insert into public.epi_catalog (org_id, type, category_id, name)
        values ('org_a', 'epi', ${I.categoryA}, 'Luva CA-999') returning id`;
      const [stock] = await admin<{ id: string }[]>`
        insert into public.epi_stock (org_id, catalog_id) values ('org_a', ${cat.id})
        returning id`;
      await admin`delete from public.epi_catalog where id = ${cat.id}`;
      const rows = await admin<{ id: string }[]>`
        select id from public.epi_stock where id = ${stock.id}`;
      expect(rows).toHaveLength(0);
    });

    // G1 (FR-012): catálogo com histórico de entrega não pode ser excluído (RESTRICT).
    it("FK epi_delivery_items.catalog_id ON DELETE RESTRICT: não exclui item do catálogo com entregas", async () => {
      // epiCatalogA é referenciado por epi_delivery_items (seed) → delete deve ser bloqueado.
      await expect(
        admin`delete from public.epi_catalog where id = ${I.epiCatalogA}`,
      ).rejects.toThrow();
    });

    // G2 (FR-015): excluir a entrega preserva o movimento; delivery_id vira NULL (SET NULL).
    it("ON DELETE SET NULL: excluir a entrega preserva o movimento e zera o delivery_id", async () => {
      // cria um movimento ligado a uma entrega nova (sem mexer no seed base)
      const [del] = await admin<{ id: string }[]>`
        insert into public.epi_deliveries (org_id, employee_id) values ('org_a', ${I.employeeA})
        returning id`;
      const [mov] = await admin<{ id: string }[]>`
        insert into public.stock_movements (org_id, stock_id, delivery_id, type, quantity)
        values ('org_a', ${I.epiStockA}, ${del.id}, 'employee_delivery', 1) returning id`;
      await admin`delete from public.epi_deliveries where id = ${del.id}`;
      const [row] = await admin<{ id: string; delivery_id: string | null }[]>`
        select id, delivery_id from public.stock_movements where id = ${mov.id}`;
      expect(row).toBeDefined(); // movimento preservado
      expect(row.delivery_id).toBeNull(); // vínculo zerado
    });

    // G3 (FR-014): excluir o funcionário remove suas entregas e os itens em cascata.
    it("ON DELETE CASCADE: excluir o funcionário remove entregas e itens de entrega", async () => {
      const [del] = await admin<{ id: string }[]>`
        insert into public.epi_deliveries (org_id, employee_id) values ('org_a', ${I.employeeA})
        returning id`;
      await admin`insert into public.epi_delivery_items (org_id, delivery_id, catalog_id, quantity)
        values ('org_a', ${del.id}, ${I.epiCatalogA}, 1)`;
      await admin`delete from public.employees where id = ${I.employeeA}`;
      const deliveries = await admin<{ id: string }[]>`
        select id from public.epi_deliveries where id = ${del.id}`;
      const items = await admin<{ id: string }[]>`
        select id from public.epi_delivery_items where delivery_id = ${del.id}`;
      expect(deliveries).toHaveLength(0);
      expect(items).toHaveLength(0);
    });
  },
);
