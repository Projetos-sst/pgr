# Data Model — Medidas de controle (5W2H)

**Zero migration.** Tabela e enum já existem (migration `0012`, schema
`src/shared/db/schema/risks.ts`). Este documento descreve o modelo **como já está** e as projeções
de leitura da fatia. Nada aqui altera schema.

## Tabela `control_measures` (existente — 0012)

| Coluna               | Tipo                                             | Notas                                                        |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `id`                 | uuid PK default `gen_random_uuid()`              |                                                              |
| `org_id`             | text NOT NULL → `orgs.id` **ON DELETE cascade**  | tenant; indexado                                             |
| `risk_id`            | uuid NOT NULL → `risks.id` **ON DELETE cascade** | indexado                                                     |
| `control_level`      | enum `control_level` NOT NULL                    | `elimination`/`collective_protection`/`administrative`/`ppe` |
| `applicable`         | boolean NOT NULL **default false**               | marca se o nível se aplica                                   |
| `justification`      | text (nullable)                                  |                                                              |
| `monitoring`         | text (nullable)                                  |                                                              |
| `action_what`        | text (nullable)                                  | 5W2H — o quê                                                 |
| `action_how`         | text (nullable)                                  | 5W2H — como                                                  |
| `action_tracking`    | text (nullable)                                  | 5W2H — formas de acompanhamento                              |
| `action_measurement` | text (nullable)                                  | 5W2H — aferição de resultados                                |
| `action_responsible` | **text** (nullable)                              | responsável (texto; **sem FK**)                              |
| `action_deadline`    | **date** (nullable)                              | prazo; Drizzle → string `"AAAA-MM-DD"`                       |
| `created_at`         | timestamptz NOT NULL default now()               | Drizzle → `Date`                                             |
| `updated_at`         | timestamptz NOT NULL default now()               | trigger `set_updated_at_control_measures`                    |

**Constraints/infra existentes**: `UNIQUE (org_id, risk_id, control_level)`
(`uq_control_measures_org_risk_level`); RLS `control_measures_isolation` PERMISSIVE FOR ALL TO
`app_runtime` (`org_id = current_setting('app.current_org', true)`); GRANT
SELECT/INSERT/UPDATE/DELETE a `app_runtime`; índices `idx_control_measures_org_id`,
`idx_control_measures_risk_id`. **Sem CHECK.** **Sem coluna de status.**

## Regras de integridade relevantes

- **Máx. 4 por risco**: garantido pela UNIQUE `(org_id, risk_id, control_level)` × 4 valores de enum.
- **Duplicidade de nível** no mesmo risco → 23505 → `DUPLICATE` / **409**.
- **`risk_id`/`org_id` ON DELETE cascade**: excluir o risco (ou a org) remove suas medidas.
- **Sem FK de entrada** em `control_measures` → **sem** endpoint de dependentes.

## Input de domínio — `ControlMeasureInput` (create e update, corpo completo)

Validado por `controlMeasureInputSchema` (Zod) **antes** do repositório:

| Campo               | Regra                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| `controlLevel`      | enum NR-01 obrigatório (create); **ignorado na escrita de update** (imutável, FR-006) |
| `applicable`        | boolean (preprocess form/JSON; default `false`)                                       |
| `justification`     | opcional (texto)                                                                      |
| `monitoring`        | opcional (texto)                                                                      |
| `actionWhat`        | **obrigatório se `applicable=true`**; senão opcional                                  |
| `actionHow`         | **obrigatório se `applicable=true`**; senão opcional                                  |
| `actionTracking`    | opcional (texto)                                                                      |
| `actionMeasurement` | opcional (texto)                                                                      |
| `actionResponsible` | opcional (texto; combobox grava `fullName`)                                           |
| `actionDeadline`    | opcional (`optionalIsoDate`, `AAAA-MM-DD`)                                            |

**Não** entram no input: `id`, `orgId` (sessão), `riskId` (rota), `createdAt`/`updatedAt`.
Campos vazios de texto → `undefined` → gravados como `NULL` (via `?? null` no `toColumns`).

## Estados derivados (não persistidos)

Função pura `deriveMeasureState(measure, today)`:

| Estado         | Condição                                                                            | Rótulo pt-BR |
| -------------- | ----------------------------------------------------------------------------------- | ------------ |
| `without_plan` | `applicable === false`                                                              | "Sem plano"  |
| `planned`      | `applicable === true` **e** não vencida                                             | "Planejada"  |
| `overdue`      | `applicable === true` **e** `actionDeadline != null` **e** `actionDeadline < today` | "Vencida"    |

`isOverdue(applicable, actionDeadline, today) = applicable && !!actionDeadline && actionDeadline < today`.
`today` = data local `America/Sao_Paulo` em `AAAA-MM-DD`, passada pelo caller. Sem prazo ⇒ nunca
vencida.

## Projeções de leitura

### `ControlMeasureListItem` (lista por risco)

```ts
type ControlMeasureListItem = {
  id: string;
  controlLevel: ControlLevel;
  applicable: boolean;
  justification: string | null;
  monitoring: string | null;
  actionWhat: string | null;
  actionHow: string | null;
  actionTracking: string | null;
  actionMeasurement: string | null;
  actionResponsible: string | null;
  actionDeadline: string | null; // coluna date → "AAAA-MM-DD"
  createdAt: Date; // coluna timestamptz → Date
};
```

O **estado derivado** (`without_plan`/`planned`/`overdue`) é computado na camada de apresentação
(ou anexado pela Action) via `deriveMeasureState(item, today)` — **não** é coluna.

### `ControlMeasure` (detalhe)

Reexport de `type ControlMeasure = InferSelectModel<typeof controlMeasures>` do schema
(`db/schema/risks.ts`) — usado por `get`/`create`/`update` (linha completa).

### Contexto (read-only, derivado; para a UI)

- **Risco** (`getRiskAction`): `agentType`, `hazard`, `description`, `sources`, `possibleInjuries`,
  `noxiousAgentCode`, `exposureTime`.
- **Avaliação vigente** (`getCurrentRiskAssessmentAction`): `riskLevel`, `result` — ou `null` →
  "Sem avaliação vigente". **Nunca** gravado em `control_measures`.

## Ordenação

Lista por risco ordenada **pela hierarquia NR-01** (ordem fixa `elimination` →
`collective_protection` → `administrative` → `ppe`), estável. Implementável por `ORDER BY` com
`CASE`/array-position ou ordenação no domínio (a lista tem ≤ 4 itens).
