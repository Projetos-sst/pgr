# Data Model — Entrega de EPI com assinatura digital (011)

Fase 1. **Zero migration**: todas as entidades já existem no modelo 008 (`src/shared/db/schema/epis.ts`,
migration `0007`). Este documento descreve **como** a fatia usa o modelo existente — não cria/altera
schema (exceção que **não** se aplica: expiração é derivada, sem coluna).

## Entidades (existentes — reuso)

### epi_deliveries (cabeçalho da entrega)

| Campo | Tipo | Notas para esta fatia |
| ----- | ---- | --------------------- |
| `id` | uuid PK | identifica a entrega |
| `org_id` | text → `orgs` CASCADE | tenant; no caminho público é **derivado da própria linha** |
| `employee_id` | uuid → `employees` CASCADE | destinatário; validar pertencer ao tenant na criação |
| `delivery_date` | date (default now) | **data** sem hora; `movement_date` dos itens = este valor |
| `signature_status` | enum `epi_signature_status` | `pending` → `signed_qr` \| `signed_link` \| `signed_manual` |
| `auth_token` | text NULLABLE; UNIQUE parcial (WHERE not null) | capacidade da rota pública; nulo p/ manual |
| `created_at` / `updated_at` | timestamptz | **`created_at` ancora a expiração de 72h** (FR-017) |

### epi_delivery_items (itens da entrega)

| Campo | Tipo | Notas |
| ----- | ---- | ----- |
| `id` | uuid PK | |
| `org_id` | text | tenant |
| `delivery_id` | uuid → `epi_deliveries` CASCADE | |
| `catalog_id` | uuid → `epi_catalog` RESTRICT | **guarda catalog_id, não stock_id** — resolver de `epi_stock.catalog_id` |
| `quantity` | integer, CHECK > 0 | quantidade entregue |

### stock_movements (movimento de baixa)

- Já possui `type = 'employee_delivery'` e `delivery_id` (→ `epi_deliveries` ON DELETE SET NULL).
- Por item entregue: 1 `INSERT` com `type='employee_delivery'`, `stock_id`, `delivery_id`,
  `quantity` (>0), `movement_date = delivery_date`.

### epi_stock (saldo materializado — alvo da baixa)

- `balance` integer, **CHECK >= 0** (backstop); `min_quantity` (CHECK >= 0); UNIQUE(`org_id`,`catalog_id`).
- Seleção lê itens com `balance > 0`; baixa faz `UPDATE balance = balance - quantity` sob `FOR UPDATE`.

### employees (destinatário)

- `full_name`, `email` (nullable), `phone` (nullable). Ausência de e-mail/telefone desabilita "Enviar Link".

## Relacionamentos

```
employees 1───* epi_deliveries 1───* epi_delivery_items *───1 epi_catalog
                      │                                            ▲
                      │ (delivery_id, SET NULL)                    │ catalog_id
                      ▼                                            │
                 stock_movements ────────── stock_id ──────► epi_stock (balance)
```

- A seleção é sobre `epi_stock` (saldo), mas o item guarda `catalog_id` (= `epi_stock.catalog_id`).
  A baixa é na **mesma** linha de `epi_stock`.

## Máquina de estados (`signature_status`)

```
pending ──(confirmação QR na rota pública)────▶ signed_qr     + baixa de estoque
pending ──(confirmação link na rota pública)──▶ signed_link   + baixa de estoque
pending ──(assinatura manual pelo gestor)─────▶ signed_manual + baixa de estoque
```

- Transição **única e idempotente**: `status != pending` → confirmação recusada (`ALREADY_SIGNED`/409).
- A baixa ocorre **junto** com a transição (mesma transação). Nunca assinar sem baixar, nem vice-versa.
- Token expirado (`created_at + 72h < now()`) e ainda `pending` → recusar (`TOKEN_EXPIRED`/410).

## Regras de validação (zod, antes do banco)

- `deliveryCreateSchema`: `employeeId` uuid; `deliveryDate` date `YYYY-MM-DD`; `items` array **não
  vazio** de `{ stockId: uuid, quantity: int > 0 }`; **sem `stockId` duplicado**.
- Método de assinatura (público): `method ∈ { qr, link }`; manual é action interna dedicada.

## Invariantes

- `epi_stock.balance` só muda por movimentações; `SUM(signed_quantity)` do histórico continua batendo
  com `balance` (herdado da 010; `employee_delivery` conta como `−`).
- `balance` nunca negativo (validação na app + `CHECK` backstop).
- Toda entrega confirmada ⇒ exatamente 1 `stock_movements(employee_delivery)` por item, com `delivery_id`.
