# Data Model — CRUD de Categorias (008)

> A entidade `categories` **já existe** (006, migration `0005`). Esta fatia **não** altera o
> schema. Abaixo: o modelo herdado (fonte da verdade em `src/shared/db/schema/categories.ts` e
> `.specs/006-cadastros-base-pgr/data-model.md`) e os **novos** tipos de entrada/saída e operações
> introduzidos no domínio e no repositório.

## Entidade `categories` (herdada da 006 — intacta)

| Coluna       | Tipo                     | Constraints                                                                    |
| ------------ | ------------------------ | ------------------------------------------------------------------------------ |
| `id`         | `uuid`                   | PK, `default gen_random_uuid()`                                                |
| `org_id`     | `text`                   | `NOT NULL` → `orgs.id` `ON DELETE CASCADE`; indexado (`idx_categories_org_id`) |
| `type`       | `category_type` (pgEnum) | `NOT NULL`; conjunto fechado `epi \| machine`                                  |
| `name`       | `text`                   | `NOT NULL`                                                                     |
| `note`       | `text`                   | nullable                                                                       |
| `created_at` | `timestamptz`            | `NOT NULL default now()`                                                       |
| `updated_at` | `timestamptz`            | `NOT NULL default now()`                                                       |

- **Unicidade**: `UNIQUE(org_id, type, name)` (`uq_categories_org_type_name`) — duplicata por
  `(escritório, tipo, nome)` é bloqueada; o mesmo nome+tipo em escritórios distintos é permitido; o
  mesmo nome em tipos distintos no mesmo escritório é permitido. (FR-013, SC-003)
- **RLS**: policy `categories_isolation` `FOR ALL TO app_runtime` com
  `org_id = current_setting('app.current_org', true)` em `USING` e `WITH CHECK`; backstop de
  isolamento (FR-021).
- **Dependentes**: **nenhuma** tabela da 006 referencia `categories` (catálogo independente, sem FK
  de entrada) ⇒ exclusão sem cascata/aviso (FR-005).

## Tipos de domínio (novos) — `src/shared/domains/pgr/categories.ts`

```text
categoryInputSchema = z.object({
  type: categoryTypeSchema,          // REUSO de validation.ts → z.enum(["epi","machine"])  (FR-010)
  name: requiredString("Nome é obrigatório"),   // trim + min(1)                            (FR-011)
  note: optionalString,              // trim → undefined quando vazio                        (FR-012)
})

CategoryInput  = z.input<typeof categoryInputSchema>    // o que a UI envia (strings de formulário)
CategoryValues = z.output<typeof categoryInputSchema>   // o que o repositório recebe (validado)
```

- Reusa `requiredString`/`optionalString` de `form-fields.ts` e `categoryTypeSchema` de
  `validation.ts` — **sem reescrever validadores** (FR-022).
- DTO de listagem: **`CategoryListItem = Category`** (sem mapeador no domínio); o rótulo de tipo
  (`epi → "EPI"`, `machine → "Máquina"`) é formatado na camada de UI, não no DTO.

## Operações do repositório — `src/shared/db/repositories/categories.ts`

| Operação                         | Assinatura                                                                     | Observações                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `listCategories` (**estender**)  | `(orgId, params?: { search?; type?; page?; pageSize? }) → Paginated<Category>` | `ilike(name)` + filtro opcional por `type`; ordenação `name` asc; offset; `{rows,total}` |
| `getCategoryById` (**novo**)     | `(orgId, id) → Category \| null`                                               | `null` quando inexistente/cross-tenant                                                   |
| `createCategory` (**refatorar**) | `(orgId, input: CategoryValues) → Category`                                    | recebe valores validados; `auditedTenantWrite(… "pgr.categories.write_rejected" …)`      |
| `updateCategory` (**novo**)      | `(orgId, id, input: CategoryValues) → Category \| null`                        | `set {…input, updatedAt}`; `null` quando inexistente/cross-tenant; `auditedTenantWrite`  |
| `deleteCategory` (**novo**)      | `(orgId, id) → boolean`                                                        | `returning({id})`; `false` quando inexistente/cross-tenant; `auditedTenantWrite`         |

- Todas as operações abrem transação por `withOrg(orgId, tx => …)` (fixa o GUC `app.current_org`)
  e filtram explicitamente por `eq(categories.orgId, orgId)` **além** da RLS (defesa em
  profundidade). (FR-020, FR-021)

## Regras de validação (mapeadas dos FRs)

| Regra                             | Onde é imposta                                            | FR / SC         |
| --------------------------------- | --------------------------------------------------------- | --------------- |
| `type ∈ {epi, machine}`           | zod (`categoryTypeSchema`) + enum `category_type` (banco) | FR-010 / SC-004 |
| `name` não-vazio (após trim)      | zod (`requiredString`)                                    | FR-011 / SC-004 |
| `note` opcional                   | zod (`optionalString`)                                    | FR-012          |
| Unicidade `(org, type, name)`     | constraint `uq_categories_org_type_name` → `DUPLICATE`    | FR-013 / SC-003 |
| Escopo pelo tenant ativo (sessão) | `withOrg` + `requireOfficeStaff` (nunca input do cliente) | FR-020 / SC-002 |
| Backstop de isolamento            | RLS `categories_isolation`; cross-tenant id → `NOT_FOUND` | FR-021 / SC-002 |
| Acesso só `owner`/`collaborator`  | `requireOfficeStaff()` (papel `client` → `FORBIDDEN`)     | FR-025 / SC-005 |

## Estados / transições

Não há máquina de estados — `categories` é um registro de catálogo simples (sem `status`, sem
ciclo de vida). Operações são CRUD direto.
