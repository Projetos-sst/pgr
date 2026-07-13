# Briefing Fundação — Modelo de dados de Treinamentos

> Issue **#28**. Fundação de dados da Fase 04. Decisões-mãe: **D1** (`computeValidUntil`), **D2**
> (`classifyTrainingStatus`), **D3** (enum de periodicidade), **D4** (`certificate_path`), **D6**
> (`valid_until` persistido) do [brainstorming](./fase04-treinamentos-brainstorming.md).
> **Migration `0015` — única da leva.**

## Escopo

Modelar 3 tabelas tenant-isoladas + 1 enum + as 2 funções puras que o resto do módulo consome. Sem
UI, sem CRUD, sem Server Action (análogo à fatia 008 do EPI).

## Modelo (novo — migration `0015`)

```
training_catalog             (org_id, name, reference_norm?, workload_hours, periodicity, description?)
  └─ training_records        (org_id, employee_id→employees, training_id→training_catalog,
                              completed_at, valid_until?, certificate_path?)
  └─ job_role_required_trainings (org_id, job_role_id→job_roles, training_id→training_catalog)
```

- **Enum** `training_periodicity`: `annual | biennial | triennial | quinquennial | single` (D3).
- **`training_catalog`**: `name text NOT NULL`, `reference_norm text` (ex.: NR-10, NR-35, nullable),
  `workload_hours integer NOT NULL CHECK (workload_hours > 0)`, `periodicity training_periodicity
NOT NULL`, `description text`. `UNIQUE(org_id, name)` → dá o `DUPLICATE`/409 da US1.
- **`training_records`**: `completed_at date NOT NULL`, `valid_until date` (nullable — `single` e
  cálculo D1), `certificate_path text` (nullable — **sem tabela `documents`**, D4).
- **`job_role_required_trainings`**: `UNIQUE(org_id, job_role_id, training_id)` (vínculo idempotente).
- Toda tabela: `org_id text NOT NULL → orgs.id` indexado, timestamps, `pgPolicy(...).enableRLS()`
  (`org_id = current_setting('app.current_org', true)` p/ `app_runtime`), GRANT + trigger
  `set_updated_at` como SQL custom na migration (padrão `companies.ts` / fatia 006).

## ON DELETE (previsível, sem soft-delete — YAGNI)

- `training_records.employee_id → employees` : **CASCADE** (some com o funcionário).
- `job_role_required_trainings.job_role_id → job_roles` : **CASCADE**.
- `training_records.training_id → training_catalog` : **RESTRICT** (não apagar item do catálogo com
  realizações — a US1 avisa via `dependents`).
- `job_role_required_trainings.training_id → training_catalog` : **RESTRICT** (idem).

## Funções puras (em `src/shared/domains/pgr/trainings.ts`)

- **`computeValidUntil(completedAt, periodicity)`** (D1): `+1/+2/+3/+5` anos; `single → null`. Única
  fonte do cálculo de validade — consumida pela escrita da US2.
- **`classifyTrainingStatus(latest, { today, dueWindowDays })`** (D2): `missing | expired | due_soon
| ok`. `single`/`valid_until null` com registro → `ok`; sem registro → `missing`. Consumida por
  US3 e US4. Comparação date-only, fuso `America/Sao_Paulo`, inclusiva.

## Regras verificáveis

- `workload_hours > 0` (CHECK no banco + zod na app); `periodicity` sempre no enum.
- `valid_until` calculado por D1 e **persistido** (D6) — não recalcular na leitura.
- `single` ⇒ `valid_until = null` ⇒ nunca expira.
- `UNIQUE(org_id, name)` no catálogo; `UNIQUE(org_id, job_role_id, training_id)` no vínculo.
- Isolamento por tenant em todas as 3 tabelas (RLS backstop).

## Testes

- **Unit**: `computeValidUntil` (as 5 periodicidades + `single→null`); `classifyTrainingStatus`
  (matriz `missing/expired/due_soon/ok` + `single`=ok + fronteiras hoje / hoje+janela).
- **Integração (Postgres efêmero `INTEGRATION_*`)**: RLS/isolamento nas 3 tabelas; FKs válidas;
  CHECK `workload_hours > 0`; UNIQUEs; cascatas (employee/job_role) e RESTRICT (catálogo em uso).

## Referência

`src/shared/db/schema/companies.ts` (template RLS) · `src/shared/db/schema/epis.ts` + migration
`0007` (fatia 008, modelo análogo) · `.specs/006-cadastros-base-pgr/` (padrão de cadeia/tenant).
