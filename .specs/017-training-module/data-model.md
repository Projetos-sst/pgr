# Phase 1 — Data Model: Módulo de Treinamentos (Fase 04)

Migration **`0016_training_module`** (única da leva). Todas as tabelas seguem o molde de
`schema/companies.ts`/`epis.ts`: `org_id text NOT NULL → orgs.id` (ON DELETE cascade) indexado,
timestamps `created_at`/`updated_at` (trigger `set_updated_at`), `pgPolicy(...).enableRLS()` de
isolamento por tenant para `app_runtime`, GRANT `SELECT,INSERT,UPDATE,DELETE`. `tenantScope =
org_id = current_setting('app.current_org', true)`.

Arquivo de schema: `src/shared/db/schema/trainings.ts` (reexportado por `schema/index.ts`).

## Enum

### `training_periodicity` (D3)

`annual | biennial | triennial | quinquennial | single` — forward-only. Rótulos PT só na UI
(Anual/Bianual/Trienal/Quinquenal/Única).

## Tabela: `training_catalog`

Catálogo de treinamentos oferecidos pelo escritório (base referenciada por realizações e vínculos).

| Coluna                      | Tipo                                 | Regras                                            |
| --------------------------- | ------------------------------------ | ------------------------------------------------- |
| `id`                        | `uuid` PK                            | `defaultRandom()`                                 |
| `org_id`                    | `text NOT NULL`                      | FK → `orgs.id` ON DELETE cascade; indexado        |
| `name`                      | `text NOT NULL`                      | ePGR: Nome                                        |
| `reference_norm`            | `text` (nullable)                    | ePGR: Norma de Referência (ex.: NR-10, NR-35)     |
| `workload_hours`            | `integer NOT NULL`                   | ePGR: Carga Horária; `CHECK (workload_hours > 0)` |
| `periodicity`               | `training_periodicity NOT NULL`      | ePGR: Periodicidade                               |
| `description`               | `text` (nullable)                    | ePGR: Descrição                                   |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | trigger `set_updated_at`                          |

- **Índices/constraints**: `idx_training_catalog_org_id`; `uq_training_catalog_org_name` UNIQUE
  `(org_id, name)` → `DUPLICATE`/409 (US1); `training_catalog_workload_hours_check` CHECK `> 0`.
- **RLS**: policy `training_catalog_isolation` FOR ALL TO `app_runtime`.

## Tabela: `training_records`

Realização de um treinamento por um funcionário (histórico; permite reciclagem — várias linhas por par).

| Coluna                      | Tipo                                 | Regras                                                      |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `id`                        | `uuid` PK                            | `defaultRandom()`                                           |
| `org_id`                    | `text NOT NULL`                      | FK → `orgs.id` ON DELETE cascade; indexado                  |
| `employee_id`               | `uuid NOT NULL`                      | FK → `employees.id` **ON DELETE CASCADE**; indexado         |
| `training_id`               | `uuid NOT NULL`                      | FK → `training_catalog.id` **ON DELETE RESTRICT**; indexado |
| `completed_at`              | `date NOT NULL`                      | data de realização; regra: não-futuro (Zod na app — US2)    |
| `valid_until`               | `date` (nullable)                    | calculado por D1 e **persistido** (D6); `single → null`     |
| `certificate_path`          | `text` (nullable)                    | D4 — sem GED/upload                                         |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | trigger `set_updated_at`                                    |

- **Índices**: `idx_training_records_org_id`, `idx_training_records_employee_id`,
  `idx_training_records_training_id`. (Consulta D5 usa `(employee_id, training_id, completed_at DESC)` —
  os índices simples cobrem o partition; sem índice composto adicional por YAGNI, revisar se necessário.)
- **RLS**: policy `training_records_isolation` FOR ALL TO `app_runtime`.
- **ON DELETE**: cascade com o funcionário; RESTRICT sobre o catálogo (item em uso não é apagado — US1
  avisa via `dependents`).

## Tabela: `job_role_required_trainings`

Vínculo que declara um treinamento como obrigatório para uma função.

| Coluna                      | Tipo                                 | Regras                                                      |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `id`                        | `uuid` PK                            | `defaultRandom()`                                           |
| `org_id`                    | `text NOT NULL`                      | FK → `orgs.id` ON DELETE cascade; indexado                  |
| `job_role_id`               | `uuid NOT NULL`                      | FK → `job_roles.id` **ON DELETE CASCADE**; indexado         |
| `training_id`               | `uuid NOT NULL`                      | FK → `training_catalog.id` **ON DELETE RESTRICT**; indexado |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | trigger `set_updated_at`                                    |

- **Índices/constraints**: `idx_job_role_required_trainings_org_id`,
  `idx_job_role_required_trainings_job_role_id`, `idx_job_role_required_trainings_training_id`;
  `uq_job_role_required_trainings_org_role_training` UNIQUE `(org_id, job_role_id, training_id)` →
  add idempotente (US4).
- **RLS**: policy `job_role_required_trainings_isolation` FOR ALL TO `app_runtime`.

## Relacionamentos

```
orgs (1) ──< training_catalog (N)
training_catalog (1) ──< training_records (N)          [RESTRICT: catálogo em uso]
training_catalog (1) ──< job_role_required_trainings (N) [RESTRICT: catálogo em uso]
employees (1) ──< training_records (N)                 [CASCADE]
job_roles (1) ──< job_role_required_trainings (N)      [CASCADE]
employees.job_role_id → job_roles.id (existente, nullable) — dá a função do funcionário p/ conformidade
```

## Funções puras (domínio — `src/shared/domains/pgr/trainings.ts`)

### `computeValidUntil(completedAt, periodicity)` (D1)

- Entrada: `completedAt` (date-only, `YYYY-MM-DD`), `periodicity` (`training_periodicity`).
- Saída: `string | null` (data `YYYY-MM-DD`); `single → null`; demais = `completedAt + {1,2,3,5}` anos.
- Determinística, sem I/O. Única fonte do cálculo (consumida na escrita de `training_records`).

### `classifyTrainingStatus(latest, { today, dueWindowDays })` (D2)

- Entrada: `latest` = `{ validUntil: string | null } | null` (último registro ou ausência);
  `today` (date-only), `dueWindowDays` (número, ex.: 30/60/90). **Nota de nomenclatura**: o filtro/API
  da US3 usa `dueWithinDays` — é o **mesmo valor em dias**, repassado verbatim a este `dueWindowDays`
  (nomes distintos por camada, não conceitos diferentes).
- Saída: `"missing" | "expired" | "due_soon" | "ok"`.
- Regra: `latest == null → missing`; `validUntil == null → ok`; `validUntil < today → expired`;
  `validUntil <= today + dueWindowDays → due_soon`; senão `ok`. Date-only, `America/Sao_Paulo`, inclusiva.

## Schemas de validação (Zod — mesmo módulo de domínio)

- `trainingPeriodicitySchema` = `z.enum([...])` (reusado por catálogo e labels).
- `trainingCatalogInputSchema`: `name` (obrigatório, trim), `referenceNorm` (opcional),
  `workloadHours` (coerce → inteiro `> 0`, senão `VALIDATION`), `periodicity` (enum), `description`
  (opcional).
- `trainingRecordInputSchema`: `employeeId` (uuid), `trainingId` (uuid), `completedAt` (`YYYY-MM-DD`,
  **não-futuro** vs. hoje `America/Sao_Paulo`), `certificatePath` (opcional). `valid_until` NÃO entra no
  input — é calculado no servidor.
- `jobRoleRequiredTrainingInputSchema`: `jobRoleId` (uuid), `trainingId` (uuid).

## Tipos derivados (repositório/leitura)

- `TrainingCatalogDependents = { records: number; requiredLinks: number }` — para `dependents` (US1).
- `TrainingStatusRow = { employeeId; employeeName; trainingId; trainingName; completedAt; validUntil;
status }` — linha do controle de vencimento (US3) e da conformidade (US4).
- `TrainingDueSummary = { expired: number; dueSoon: number }` — resumo para dashboard (US3, D7).
