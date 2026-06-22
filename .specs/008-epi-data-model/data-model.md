# Phase 1 — Data Model: Módulo de EPIs

Convenções herdadas (toda tabela): PK `uuid` defaultRandom; `org_id text NOT NULL → orgs.id
ON DELETE CASCADE`, indexado `idx_<t>_org_id`; `created_at`/`updated_at` `timestamptz NOT NULL
DEFAULT now()` + trigger `set_updated_at_<t>`; RLS habilitado + policy `<t>_isolation`
(`app_runtime`, `org_id = current_setting('app.current_org', true)` em USING/WITH CHECK); GRANT
`SELECT,INSERT,UPDATE,DELETE TO app_runtime`. Enum reusado: `category_type` (`epi`/`machine`).
Enums novos: `stock_movement_type`, `epi_signature_status`.

## Diagrama de relações

```text
categories (006) ──< epi_catalog ──< epi_stock ──< stock_movements >── epi_deliveries >── employees (006)
   (id,type) ⤴            │                                   │
   (FK composta)          ├──< epi_delivery_items >───────────┘
                          └──< epi_risk >── ges (006)   [interino]
```

## Alteração aditiva em `categories` (006) — FR-002a

- Novo `UNIQUE(id, type)` → `uq_categories_id_type` (habilita a FK composta de `epi_catalog`).
  Aditivo e seguro (`id` já é PK único). Sem mudança de dados.

## Entidades

### `epi_catalog` — catálogo de itens (EPI / Máquina)

| Campo | Tipo | Regras |
| ----- | ---- | ------ |
| id | uuid | PK |
| org_id | text | NOT NULL → orgs.id (cascade), indexado |
| type | category_type | NOT NULL |
| category_id | uuid | NOT NULL, indexado |
| (category_id, type) | — | **FK composta → categories(id, type)**, `ON DELETE RESTRICT` (FR-002a) |
| name | text | NOT NULL |
| ca | text | nullable (nº do Certificado de Aprovação) |
| ca_valid_until | date | nullable (validade do CA) |
| manufacturer | text | nullable |
| norm | text | nullable |
| size | text | nullable |
| unit_of_measure | text | nullable — **texto livre** (FR-001) |
| description | text | nullable |
| photo_path | text | nullable (referência de Storage; upload é futuro) |
| timestamps | timestamptz | NOT NULL DEFAULT now() + trigger |

### `epi_stock` — estoque por item

| Campo | Tipo | Regras |
| ----- | ---- | ------ |
| id | uuid | PK |
| org_id | text | NOT NULL → orgs.id (cascade), indexado |
| catalog_id | uuid | NOT NULL → epi_catalog.id `ON DELETE CASCADE`, indexado |
| balance | integer | NOT NULL DEFAULT 0, **CHECK ≥ 0** (materializado) |
| min_quantity | integer | NOT NULL DEFAULT 0, **CHECK ≥ 0** |
| timestamps | timestamptz | NOT NULL DEFAULT now() + trigger |

- `UNIQUE(org_id, catalog_id)` → `uq_epi_stock_org_catalog` (um estoque por item por tenant).

### `stock_movements` — movimentos tipados

| Campo | Tipo | Regras |
| ----- | ---- | ------ |
| id | uuid | PK |
| org_id | text | NOT NULL → orgs.id (cascade), indexado |
| stock_id | uuid | NOT NULL → epi_stock.id `ON DELETE CASCADE`, indexado |
| delivery_id | uuid | **nullable** → epi_deliveries.id `ON DELETE SET NULL`, indexado |
| type | stock_movement_type | NOT NULL (`purchase`/`employee_delivery`/`adjustment`/`discard`) |
| quantity | integer | NOT NULL, **CHECK > 0** (sempre positivo; sentido derivado do tipo) |
| movement_date | date | NOT NULL DEFAULT now() |
| invoice_number | text | nullable |
| timestamps | timestamptz | NOT NULL DEFAULT now() + trigger |

### `epi_deliveries` — entregas com assinatura

| Campo | Tipo | Regras |
| ----- | ---- | ------ |
| id | uuid | PK |
| org_id | text | NOT NULL → orgs.id (cascade), indexado |
| employee_id | uuid | NOT NULL → employees.id `ON DELETE CASCADE`, indexado |
| delivery_date | date | NOT NULL DEFAULT now() |
| signature_status | epi_signature_status | NOT NULL DEFAULT `pending` |
| auth_token | text | nullable — **único GLOBAL** via índice parcial `WHERE auth_token IS NOT NULL` (FR-008) |
| timestamps | timestamptz | NOT NULL DEFAULT now() + trigger |

### `epi_delivery_items` — itens de cada entrega

| Campo | Tipo | Regras |
| ----- | ---- | ------ |
| id | uuid | PK |
| org_id | text | NOT NULL → orgs.id (cascade), indexado |
| delivery_id | uuid | NOT NULL → epi_deliveries.id `ON DELETE CASCADE`, indexado |
| catalog_id | uuid | NOT NULL → epi_catalog.id `ON DELETE RESTRICT`, indexado |
| quantity | integer | NOT NULL, **CHECK > 0** |
| timestamps | timestamptz | NOT NULL DEFAULT now() + trigger |

### `epi_risk` — vínculo EPI × risco do GES (interino)

| Campo | Tipo | Regras |
| ----- | ---- | ------ |
| id | uuid | PK |
| org_id | text | NOT NULL → orgs.id (cascade), indexado |
| catalog_id | uuid | NOT NULL → epi_catalog.id `ON DELETE CASCADE`, indexado |
| ges_id | uuid | NOT NULL → ges.id `ON DELETE CASCADE` (interino), indexado |
| neutralizes | boolean | NOT NULL DEFAULT false |
| timestamps | timestamptz | NOT NULL DEFAULT now() + trigger |

- `UNIQUE(org_id, catalog_id, ges_id)` → `uq_epi_risk_org_catalog_ges`.

## Regras de validação (zod, em `src/shared/domains/pgr/validation.ts`)

- `stockMovementTypeSchema` = enum(`purchase`,`employee_delivery`,`adjustment`,`discard`).
- `epiSignatureStatusSchema` = enum(`pending`,`signed_qr`,`signed_link`,`signed_manual`).
- `epiQuantitySchema` = inteiro positivo (espelha `CHECK quantity > 0`).

## Estados / transições

- `signature_status`: inicia `pending`; transições (`→ signed_qr|signed_link|signed_manual`)
  são da **Fase 2** (fluxo de assinatura), fora desta fatia.
- `balance`: alterado pelos movimentos na **Fase 2**; aqui só o valor + CHECK ≥ 0.
