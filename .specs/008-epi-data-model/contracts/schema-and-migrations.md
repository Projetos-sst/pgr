# Contrato — Schema & Migration (EPIs)

Contrato técnico desta fatia de dados. A interface "externa" aqui é o **schema do banco** que a
Fase 2 (repositórios/Server Actions) vai consumir, e a **migration** que o produz.

## 1. Schema Drizzle (code-first)

- Arquivo: `src/shared/db/schema/epis.ts`, exportado em `src/shared/db/schema/index.ts`.
- 6 tabelas: `epiCatalog`, `epiStock`, `stockMovements`, `epiDeliveries`, `epiDeliveryItems`,
  `epiRisk`. 2 enums novos: `stockMovementType`, `epiSignatureStatus`. Reuso de `categoryType`.
- Tipos exportados: `InferSelectModel`/`InferInsertModel` de cada tabela (`EpiCatalog`,
  `NewEpiCatalog`, …).
- Toda tabela: `.enableRLS()` + `pgPolicy("<t>_isolation", {for:"all", to: appRuntimeRole,
using: tenantScope, withCheck: tenantScope})`, `tenantScope = sql\`org_id =
  current_setting('app.current_org', true)\``.

### Delta FR-002a (consistência de tipo)

- `categories.ts`: adicionar `uniqueIndex("uq_categories_id_type").on(categories.id, categories.type)`.
- `epis.ts` / `epiCatalog`: trocar a FK simples de `categoryId` por **FK composta** no nível da
  tabela:
  ```ts
  foreignKey({
    columns: [table.categoryId, table.type],
    foreignColumns: [categories.id, categories.type],
    name: "epi_catalog_category_id_type_fk",
  }).onDelete("restrict");
  ```
  (mantém o índice `idx_epi_catalog_category_id`; remove o `.references()` inline de `categoryId`).

## 2. Migration

- Gerar com `drizzle-kit generate` → `src/shared/db/migrations/0007_epi_data_model.sql`
  (+ snapshot/journal em `meta/`). **Pré-condição**: `DATABASE_URL_UNPOOLED` definido no ambiente
  (o gerador exige a var, mas não conecta).
- Adicionar **manualmente** ao SQL (padrão da 0005):
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO app_runtime` para as 6 tabelas.
  - `DROP TRIGGER IF EXISTS set_updated_at_<t> ...; CREATE TRIGGER set_updated_at_<t>
BEFORE UPDATE ON public.<t> FOR EACH ROW EXECUTE FUNCTION set_updated_at();` para as 6.
- O delta FR-002a entra na **mesma** migration `0007` se ela ainda não foi aplicada em ambiente
  algum; caso já tenha sido aplicada, criar `0008_epi_catalog_type_fk.sql` com:
  `CREATE UNIQUE INDEX uq_categories_id_type ON public.categories (id, type);` +
  `ALTER TABLE public.epi_catalog DROP CONSTRAINT epi_catalog_category_id_categories_id_fk,
ADD CONSTRAINT epi_catalog_category_id_type_fk FOREIGN KEY (category_id, type)
REFERENCES public.categories (id, type) ON DELETE RESTRICT;`
- Aplicar via conexão direta **unpooled** (owner).

## 3. Garantias verificáveis (contrato de aceite)

| Garantia                                                                   | Como verificar                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| 6 tabelas criadas, RLS habilitado, policy `<t>_isolation` p/ `app_runtime` | `epi-migration-shape.test.ts`                  |
| `org_id` NOT NULL + indexado; trigger `set_updated_at_<t>`; GRANT          | `epi-migration-shape.test.ts`                  |
| Enums com os membros esperados; FK de `epi_catalog` → `categories`         | `epi-migration-shape.test.ts`                  |
| CHECK `quantity > 0`; `balance/min_quantity ≥ 0`                           | `epi-constraints.test.ts`                      |
| UNIQUE estoque `(org,catalog)`; risco `(org,catalog,ges)`; token parcial   | `epi-constraints.test.ts`                      |
| ON DELETE RESTRICT (categoria/catálogo em uso) e CASCADE (cadeia)          | `epi-constraints.test.ts`                      |
| **FR-002a**: item de tipo ≠ categoria é rejeitado                          | **novo caso** em `epi-constraints.test.ts`     |
| Isolamento multi-tenant (leitura/escrita cross-tenant barradas)            | 6× `*-isolation.test.ts` (`runIsolationSuite`) |

> Testes de integração rodam **somente** com `INTEGRATION_DATABASE_URL`/`INTEGRATION_APP_RUNTIME_URL`
> apontando para **Postgres efêmero** (`describe.skip` sem eles). Nunca SQLite (Constituição).
