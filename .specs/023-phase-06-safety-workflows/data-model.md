# Data Model — Fase 06 (023)

Migration única **`0024_phase_06_safety_workflows`** (idx 24), gerada por `drizzle-kit` **após** a reconciliação do journal (research.md §1). Todas as tabelas seguem o template de `schema/companies.ts`: `org_id text NOT NULL → orgs.id (ON DELETE cascade)`, índice em `org_id`, trigger `set_updated_at` (SQL custom), GRANT a `app_runtime`, RLS `enableRLS()` + `pgPolicy(for:"all", to: appRuntimeRole, using: tenantScope, withCheck: tenantScope)` onde `tenantScope = org_id = current_setting('app.current_org', true)`.

**Não alterar** (fora do escopo): `control_measures`, `esocial_events`, `inspections`, `inspection_occurrences`.

Convenções: PK `id uuid default gen_random_uuid()`; timestamps `timestamptz` (`created_at`/`updated_at` `NOT NULL default now()`); datas de negócio `date`; dinheiro `numeric`.

---

## Enums novos (pgEnum)

| Enum                   | Valores                                                                            | Tabela         |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------- |
| `service_order_status` | `open`, `in_progress`, `completed`, `cancelled`                                    | service_orders |
| `accident_type`        | `typical`, `commute`, `occupational_disease`                                       | accidents      |
| `accident_category`    | `with_leave`, `without_leave`, `fatal` _(a confirmar no domínio; fechado)_         | accidents      |
| `accident_severity`    | `minor`, `moderate`, `severe`, `fatal`                                             | accidents      |
| `accident_status`      | `registered`, `awaiting_planning`, `awaiting_completion`, `completed`, `cancelled` | accidents      |
| `action_plan_status`   | `planned`, `in_progress`, `completed`, `cancelled`                                 | action_plans   |
| `risk_audit_status`    | `awaiting_analysis`, `planning_actions`, `completed`                               | risk_audits    |

**Colunas que permanecem `text` (NÃO enum) de propósito:**

- `service_order_items.source_type` — validado na app (`manual|risk|epi`), para não migrar ao ampliar fontes.
- `action_plans.origin_type` e `risk_audits.origin_type` — validados na app (`risk|incident` na V1), extensíveis sem migration.

> Rótulos PT ficam na UI; o banco usa identificadores em inglês. Os valores exatos de `accident_type`/`accident_category` são fixados no módulo de domínio `accidents.ts` na implementação (Bloco D) — o conjunto é **fechado**, sem lookup externo.

---

## 1. `service_orders`

| Coluna                      | Tipo                   | Nulo | Notas                                      |
| --------------------------- | ---------------------- | ---- | ------------------------------------------ |
| `id`                        | uuid PK                | não  |                                            |
| `org_id`                    | text                   | não  | → `orgs.id` ON DELETE cascade              |
| `number`                    | integer                | não  | calculado no servidor (`max+1` por tenant) |
| `title`                     | text                   | não  |                                            |
| `assigned_employee_id`      | uuid                   | sim  | → `employees.id` ON DELETE set null        |
| `opened_at`                 | date                   | não  | default hoje (app)                         |
| `due_date`                  | date                   | sim  |                                            |
| `closed_at`                 | date                   | sim  | preenchido ao concluir                     |
| `status`                    | `service_order_status` | não  | default `open`                             |
| `created_at` / `updated_at` | timestamptz            | não  | trigger `set_updated_at`                   |

- **UNIQUE**: `uq_service_orders_org_id_number (org_id, number)` — backstop da numeração.
- **Índices**: `idx_service_orders_org_id (org_id)`; `idx_service_orders_org_status (org_id, status)` (filtro de listagem); `idx_service_orders_assigned (org_id, assigned_employee_id)`.
- **Derivados (não persistir)**: `days_open` (de `opened_at`/`closed_at`, fuso America/Sao_Paulo); estado/data de assinatura (de `signature_requests`/`signature_captures`).
- **RLS**: policy `service_orders_isolation` (`for:"all"`, using+withCheck tenantScope).

## 2. `service_order_items`

| Coluna                      | Tipo        | Nulo | Notas                                                  |
| --------------------------- | ----------- | ---- | ------------------------------------------------------ |
| `id`                        | uuid PK     | não  |                                                        |
| `org_id`                    | text        | não  | → `orgs.id` ON DELETE cascade (carrega tenant próprio) |
| `service_order_id`          | uuid        | não  | → `service_orders.id` ON DELETE cascade                |
| `description`               | text        | não  | snapshot textual (≤500 no domínio)                     |
| `source_type`               | text        | não  | validado app: `manual\|risk\|epi`                      |
| `source_id`                 | uuid        | sim  | referência **fraca** à origem do snapshot (sem FK)     |
| `done`                      | boolean     | não  | default false                                          |
| `sort_order`                | integer     | não  | default 0                                              |
| `created_at` / `updated_at` | timestamptz | não  |                                                        |

- **Índices**: `idx_soi_org_id (org_id)`; `idx_soi_order (org_id, service_order_id, sort_order)`.
- **Transacional**: OS + itens gravam na mesma transação (rollback conjunto). Itens **imutáveis** após a OS assinada.
- **RLS**: policy `service_order_items_isolation` (`for:"all"`).

## 3. `accidents` (rótulo UI "Incidentes/Acidentes")

| Coluna                                                 | Tipo                | Nulo | Notas                                   |
| ------------------------------------------------------ | ------------------- | ---- | --------------------------------------- |
| `id`                                                   | uuid PK             | não  |                                         |
| `org_id`                                               | text                | não  | → `orgs.id` cascade                     |
| `company_id`                                           | uuid                | não  | → `companies.id` ON DELETE cascade      |
| `employee_id`                                          | uuid                | sim  | → `employees.id` ON DELETE set null     |
| `occurred_at`                                          | timestamptz         | não  |                                         |
| `type`                                                 | `accident_type`     | não  |                                         |
| `category`                                             | `accident_category` | não  |                                         |
| `severity`                                             | `accident_severity` | não  |                                         |
| `status`                                               | `accident_status`   | não  | default `registered`                    |
| `location`                                             | text                | sim  |                                         |
| `description`                                          | text                | sim  |                                         |
| `away_from_work`                                       | boolean             | sim  |                                         |
| `worked_hours`                                         | numeric             | sim  |                                         |
| `hospital`                                             | text                | sim  | **dado sensível**                       |
| `injury_nature_code` / `injury_nature_description`     | text                | sim  | CAT interno, textual                    |
| `body_part_code` / `body_part_description`             | text                | sim  | CAT interno, textual                    |
| `causative_agent_code` / `causative_agent_description` | text                | sim  | CAT interno, textual                    |
| `causes`                                               | text                | sim  |                                         |
| `environmental_impact`                                 | text                | sim  |                                         |
| `material_loss`                                        | text                | sim  |                                         |
| `third_parties`                                        | text                | sim  |                                         |
| `fatality_potential`                                   | boolean             | sim  |                                         |
| `responsible_area`                                     | text                | sim  |                                         |
| `activity_procedure`                                   | text                | sim  |                                         |
| `witnesses`                                            | text                | sim  | **dado pessoal de terceiros**           |
| `investigation_notes`                                  | text                | sim  |                                         |
| `cat_number`                                           | text                | sim  | registro interno (sem S-2210)           |
| `cat_issued_at`                                        | date                | sim  |                                         |
| `completion_justification`                             | text                | sim  | exigido na conclusão (regra de domínio) |
| `completed_at`                                         | timestamptz         | sim  |                                         |
| `created_at` / `updated_at`                            | timestamptz         | não  |                                         |

- **Índices**: `idx_accidents_org_id (org_id)`; `idx_accidents_org_status (org_id, status)`; `idx_accidents_company (org_id, company_id)`; `idx_accidents_occurred (org_id, occurred_at)`.
- **State machine (persistida em `status`)**: `registered → awaiting_planning → awaiting_completion → completed`; `cancelled` a partir de não-terminais; terminal (`completed`/`cancelled`) não volta. Regras puras em `incident-lifecycle.ts`.
- **Privacidade P0**: `hospital`, `witnesses`, `employee_id`, códigos/descrições de lesão **nunca** em log/audit/payload público/IA.
- **RLS**: policy `accidents_isolation` (`for:"all"`). Acesso só office staff (gate de aplicação, `client`→403).

## 4. `action_plans`

| Coluna                                   | Tipo                 | Nulo | Notas                                  |
| ---------------------------------------- | -------------------- | ---- | -------------------------------------- |
| `id`                                     | uuid PK              | não  |                                        |
| `org_id`                                 | text                 | não  | → `orgs.id` cascade                    |
| `origin_type`                            | text                 | não  | validado app: `risk\|incident` (V1)    |
| `origin_id`                              | uuid                 | não  | **sem FK física** (polimórfico)        |
| `what` / `why` / `who` / `where` / `how` | text                 | não  | 5W2H                                   |
| `when`                                   | date                 | sim  | prazo (base do `overdue`)              |
| `how_much`                               | numeric              | sim  | valor monetário                        |
| `priority`                               | text/smallint        | sim  | prioridade (domínio define o conjunto) |
| `status`                                 | `action_plan_status` | não  | default `planned`                      |
| `completed_at`                           | timestamptz          | sim  | gravado ao concluir                    |
| `cancelled_at`                           | timestamptz          | sim  | gravado ao cancelar                    |
| `created_at` / `updated_at`              | timestamptz          | não  |                                        |

- **Índices**: `idx_action_plans_org_id (org_id)`; `idx_action_plans_origin (org_id, origin_type, origin_id)` (central multiorigem + validação); `idx_action_plans_org_status (org_id, status)`.
- **Sem FK em `origin_id`**: validação de existência/tenant na aplicação → `FK_NOT_FOUND` (422) para origem inexistente/tipo não suportado/cross-tenant. Origem removida depois → plano **permanece** (histórico "Origem removida" na UI).
- **Derivado**: `overdue` (de `when` vs hoje, fuso America/Sao_Paulo; só para não-terminais).
- **Exclusão**: física só se `planned` e sem dependentes; senão cancelamento.
- **RLS**: policy `action_plans_isolation` (`for:"all"`).

## 5. `risk_audits`

| Coluna                      | Tipo                | Nulo | Notas                                           |
| --------------------------- | ------------------- | ---- | ----------------------------------------------- |
| `id`                        | uuid PK             | não  |                                                 |
| `org_id`                    | text                | não  | → `orgs.id` cascade                             |
| `origin_type`               | text                | não  | validado app: `risk\|incident` (V1)             |
| `origin_id`                 | uuid                | não  | sem FK física (polimórfico)                     |
| `status`                    | `risk_audit_status` | não  | default `awaiting_analysis`                     |
| `justification`             | text                | sim  | obrigatória nas transições definidas pela regra |
| `started_at`                | timestamptz         | sim  |                                                 |
| `completed_at`              | timestamptz         | sim  |                                                 |
| `created_at` / `updated_at` | timestamptz         | não  |                                                 |

- **UNIQUE parcial (uma ativa por origem)**: `uq_risk_audits_active_origin ON (org_id, origin_type, origin_id) WHERE status <> 'completed'`.
- **Índices**: `idx_risk_audits_org_id (org_id)`; `idx_risk_audits_origin (org_id, origin_type, origin_id)`; `idx_risk_audits_org_status (org_id, status)`.
- **Transições**: só por Actions explícitas (não por drag-and-drop persistente); `awaiting_analysis → planning_actions → completed`. Planos vinculam-se à **origem**, não à auditoria. Não substitui a state machine do incidente.
- **RLS**: policy `risk_audits_isolation` (`for:"all"`).

---

## SQL custom da migration (fora do que o drizzle-kit auto-emite)

- GRANTs a `app_runtime` (SELECT/INSERT/UPDATE/DELETE) por tabela — padrão das migrations `0001`/`0005`.
- Triggers `set_updated_at BEFORE UPDATE` por tabela — reusar a função existente.
- A UNIQUE parcial de `risk_audits` (índice parcial com `WHERE`) — confirmar se sai do `pgPolicy`/`uniqueIndex` do Drizzle ou entra como `CREATE UNIQUE INDEX ... WHERE` custom.

## Rastreabilidade tabela → FR

| Tabela              | FRs                                    |
| ------------------- | -------------------------------------- |
| service_orders      | FR-007, FR-008, FR-012..FR-015         |
| service_order_items | FR-009, FR-010, FR-011                 |
| accidents           | FR-021, FR-022, FR-025, FR-027..FR-029 |
| action_plans        | FR-031, FR-032, FR-034..FR-036         |
| risk_audits         | FR-037, FR-038, FR-040                 |
| (todas)             | FR-001, FR-003 (RLS/GRANT/trigger)     |
