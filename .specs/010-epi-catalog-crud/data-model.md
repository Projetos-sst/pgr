# Data Model — CRUD de Catálogo de EPI / Equipamentos (010)

> A entidade `epi_catalog` e seus dependentes **já existem** (008, migrations `0007`/`0008`). Esta
> fatia **não** altera o schema. Abaixo: o modelo herdado (fonte da verdade em
> `src/shared/db/schema/epis.ts` e `.specs/008-epi-data-model/data-model.md`) e os **novos** tipos de
> entrada/saída e operações introduzidos no domínio e no repositório.

## Entidade `epi_catalog` (herdada da 008 — intacta)

| Coluna            | Tipo                     | Constraints                                                                     |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `id`              | `uuid`                   | PK, `default gen_random_uuid()`                                                 |
| `org_id`          | `text`                   | `NOT NULL` → `orgs.id` `ON DELETE CASCADE`; indexado (`idx_epi_catalog_org_id`) |
| `type`            | `category_type` (pgEnum) | `NOT NULL`; conjunto fechado `epi \| machine`                                   |
| `category_id`     | `uuid`                   | `NOT NULL`; indexado (`idx_epi_catalog_category_id`)                            |
| `name`            | `text`                   | `NOT NULL`                                                                      |
| `ca`              | `text`                   | nullable (Certificado de Aprovação)                                             |
| `ca_valid_until`  | `date`                   | nullable (validade do CA)                                                       |
| `manufacturer`    | `text`                   | nullable                                                                        |
| `norm`            | `text`                   | nullable (exibido como **Norma**)                                               |
| `size`            | `text`                   | nullable                                                                        |
| `unit_of_measure` | `text`                   | nullable                                                                        |
| `description`     | `text`                   | nullable                                                                        |
| `photo_path`      | `text`                   | nullable (caminho/URL textual — **sem upload** nesta fatia)                     |
| `created_at`      | `timestamptz`            | `NOT NULL default now()`                                                        |
| `updated_at`      | `timestamptz`            | `NOT NULL default now()` (trigger `set_updated_at_epi_catalog`)                 |

- **FK composta**: `epi_catalog_category_id_type_fk (category_id, type) → categories(id, type)`
  `ON DELETE RESTRICT`. Garante no banco que `item.type == categoria.type` (FR-012). ⚠️ A FK ignora
  RLS ⇒ exige `assertCategoryInTenant` no app (Research D1).
- **RLS**: policy `epi_catalog_isolation` `FOR ALL TO app_runtime` com
  `org_id = current_setting('app.current_org', true)` em `USING` e `WITH CHECK`; backstop de
  isolamento (FR-021).
- **Sem UNIQUE**: o modelo 008 não define unicidade em `epi_catalog`; homônimos permitidos (FR-017).

## Dependentes de `epi_catalog` (herdados da 008 — relevantes só p/ exclusão)

| Tabela dependente    | FK p/ `epi_catalog` | `ON DELETE` (banco) | Papel nesta fatia                                            |
| -------------------- | ------------------- | ------------------- | ------------------------------------------------------------ |
| `epi_stock`          | `catalog_id`        | `CASCADE`           | Bloqueia exclusão (pré-checagem app, D2) — **não** cascateia |
| `epi_risk`           | `catalog_id`        | `CASCADE`           | Bloqueia exclusão (pré-checagem app, D2) — **não** cascateia |
| `epi_delivery_items` | `catalog_id`        | `RESTRICT`          | Bloqueia exclusão (pré-checagem app **+** backstop de banco) |

> Decisão Q2/Opção B: a aplicação bloqueia a exclusão se **qualquer** das três tiver linha (FR-015).

## Tipos de domínio (novos) — `src/shared/domains/pgr/epi-catalog.ts`

```text
epiCatalogInputSchema = z.object({
  type:          categoryTypeSchema,                    // REUSO validation.ts → z.enum(["epi","machine"])  (FR-010)
  categoryId:    z.string().uuid("Categoria inválida"), // obrigatório                                       (FR-012)
  name:          requiredString("Nome é obrigatório"),  // trim + min(1)                                     (FR-011)
  ca:            optionalString,                        // trim → undefined quando vazio
  caValidUntil:  optionalIsoDate,                       // vazio→undefined OU "YYYY-MM-DD" válida             (FR-013)
  manufacturer:  optionalString,
  norm:          optionalString,                        // "Norma"
  size:          optionalString,
  unitOfMeasure: optionalString,
  description:   optionalString,
  photoPath:     optionalString,                        // caminho/URL textual (sem upload)
})

EpiCatalogInput  = z.input<typeof epiCatalogInputSchema>    // o que a UI envia (strings de formulário)
EpiCatalogValues = z.output<typeof epiCatalogInputSchema>   // o que o repositório recebe (validado)

// DTO de listagem (linha): item + nome da categoria (do join, Research D3)
EpiCatalogListItem = EpiCatalog & { categoryName: string }
```

- Reusa `requiredString`/`optionalString` de `form-fields.ts` e `categoryTypeSchema` de
  `validation.ts` — **sem reescrever validadores** (FR-022).
- **`optionalIsoDate`** (novo helper em `form-fields.ts` ou no domínio): `z` que aceita string vazia
  → `undefined` ou data ISO `YYYY-MM-DD` válida; valor malformado → `VALIDATION` (Research D5).
- O rótulo de tipo (`epi → "EPI"`, `machine → "Máquinas e Equipamentos"`) é formatado na UI, não no
  DTO.

## Operações do repositório — `src/shared/db/repositories/epi-catalog.ts` (todas novas)

| Operação                           | Assinatura                                                                               | Observações                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listEpiCatalog`                   | `(orgId, params?: { search?; type?; page?; pageSize? }) → Paginated<EpiCatalogListItem>` | `innerJoin(categories)` **escopado por tenant**: `and(eq(epiCatalog.categoryId, categories.id), eq(categories.orgId, orgId), eq(categories.type, epiCatalog.type))`; `where eq(epiCatalog.orgId, orgId)` + busca `or(ilike(epiCatalog.name), ilike(epiCatalog.ca), ilike(categories.name))` + filtro `eq(epiCatalog.type)`; ordenação `name` asc; offset; `{rows,total}` (D3) |
| `getEpiCatalogById`                | `(orgId, id) → EpiCatalog \| null`                                                       | `where eq(orgId) and eq(id)`; `null` quando inexistente/cross-tenant                                                                                                                                                                                                                                                                                                          |
| `createEpiCatalog`                 | `(orgId, input: EpiCatalogValues) → EpiCatalog`                                          | `assertCategoryInTenant` (D1) → insert; `auditedTenantWrite("pgr.epi_catalog.write_rejected")`                                                                                                                                                                                                                                                                                |
| `updateEpiCatalog`                 | `(orgId, id, input: EpiCatalogValues) → EpiCatalog \| null`                              | `assertCategoryInTenant` (D1) → update `set {…, updatedAt}`; `null` cross-tenant; `auditedTenantWrite`                                                                                                                                                                                                                                                                        |
| `deleteEpiCatalog`                 | `(orgId, id) → boolean`                                                                  | **transação única `withOrg`** (D2): `SELECT id … WHERE org_id AND id FOR UPDATE` (trava a linha; `false` se ausente/cross-tenant) → conta dependentes **após o lock** → `EntityInUseError` se >0 → senão `DELETE … RETURNING {id}`; `try/catch` `23503`→`EntityInUseError` (backstop); `auditedTenantWrite`                                                                   |
| `countEpiCatalogDependents`        | `(orgId, id) → { stock: number; risk: number; deliveryItems: number }`                   | 3 `count(*)::int` (escopo `org_id = orgId`) sob `withOrg`; leitura informativa **sem lock**, usada pela action de dependentes (UI). O caminho de delete faz sua própria contagem **após** o `FOR UPDATE` (D2)                                                                                                                                                                 |
| `assertCategoryInTenant` (privada) | `(tx, orgId, categoryId, type) → void`                                                   | select `categories` por `(org_id, id, type)`; `ReferenceNotFoundError("category")` se ausente                                                                                                                                                                                                                                                                                 |

- Todas abrem transação por `withOrg(orgId, tx => …)` (fixa o GUC `app.current_org`) e filtram
  explicitamente por `eq(epiCatalog.orgId, orgId)` **além** da RLS (defesa em profundidade).
  (FR-020/021)
- **Join sempre escopado por tenant**: toda consulta que junta `categories` filtra também
  `categories.org_id = orgId` e a coerência de tipo `categories.type = epi_catalog.type` na própria
  condição do join — defesa em profundidade mesmo com `withOrg`/RLS (D3).
- **`deleteEpiCatalog` é atômico**: lock (`FOR UPDATE`) + contagem de dependentes + `DELETE`
  ocorrem na **mesma** transação `withOrg`, fechando a corrida entre contar e deletar (D2).
- `toEpiCatalogColumns(input)` mapeia `EpiCatalogValues` → colunas, normalizando `undefined → null`
  nos campos nullable.

## Regras de validação (mapeadas dos FRs)

| Regra                                                 | Onde é imposta                                                                                                                                              | FR / SC             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `type ∈ {epi, machine}`                               | zod (`categoryTypeSchema`) + enum `category_type` (banco)                                                                                                   | FR-010 / SC-005     |
| `name` não-vazio (após trim)                          | zod (`requiredString`)                                                                                                                                      | FR-011 / SC-005     |
| `categoryId` obrigatório (uuid)                       | zod (`z.string().uuid()`)                                                                                                                                   | FR-012 / SC-005     |
| `caValidUntil` data ISO válida quando presente        | zod (`optionalIsoDate`)                                                                                                                                     | FR-013 / SC-005     |
| opcionais aceitam ausência/nulo                       | zod (`optionalString`)                                                                                                                                      | FR-013              |
| **Tipo×Categoria coerente + categoria no tenant**     | `assertCategoryInTenant` (app) **+** FK composta (banco)                                                                                                    | FR-012 / SC-004     |
| Escopo pelo tenant ativo (sessão)                     | `withOrg` + `requireOfficeStaff` (nunca input do cliente)                                                                                                   | FR-020 / SC-003     |
| Backstop de isolamento; cross-tenant id → `NOT_FOUND` | RLS `epi_catalog_isolation`                                                                                                                                 | FR-021 / SC-003     |
| **Exclusão bloqueada por dependente**                 | `deleteEpiCatalog` atômico: `FOR UPDATE` + contagem + delete na mesma tx → `EntityInUseError`/`IN_USE`; `RESTRICT` (banco) como backstop (`23503`→`IN_USE`) | FR-015/016 / SC-007 |
| **`IN_USE` chega à UI como contrato**                 | `EntityInUseError` → `toActionError` (ramo `AppError`) → `ActionResult{ ok:false, error.code:"IN_USE" }` (≈409), sem exceção crua                           | FR-016/023 / SC-007 |
| Sem unicidade (homônimos aceitos)                     | nenhuma constraint; sem pré-checagem                                                                                                                        | FR-017 / SC-008     |
| Acesso só `owner`/`collaborator`                      | `requireOfficeStaff()` (papel `client` → `FORBIDDEN`)                                                                                                       | FR-025 / SC-009     |

## Estados / transições

Não há máquina de estados — `epi_catalog` é um registro de catálogo (sem `status`, sem ciclo de
vida). Operações são CRUD direto; a única "transição" relevante é a **exclusão condicionada** à
ausência de dependentes (D2).
