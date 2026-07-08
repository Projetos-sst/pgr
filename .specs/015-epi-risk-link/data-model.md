# Phase 1 — Data Model: Vínculo EPI × risco com neutralização

> Evolui **uma** tabela existente (`epi_risk`, fatia 008) — não cria tabelas novas. Convenções de
> tenant herdadas (PK uuid, `org_id → orgs.id` indexado, timestamps + trigger `set_updated_at`, RLS
> `<t>_isolation` com GUC `app.current_org`, GRANT) são **preservadas** da 008.

## Diagrama de relações

```text
risks ──< epi_risk >── epi_catalog        (era: ges ──< epi_risk >── epi_catalog)
  (id)     │  (cascade em ambos os lados)     (catalog_id mantém-se; ges_id vira risk_id)
           └─ neutralization: epi_neutralization  (era: neutralizes boolean)
```

## Enum novo

- `epi_neutralization` = (`neutralizes`, `does_not_neutralize`, `not_applicable`).
  - Rótulos pt-BR na UI: **Sim** / **Não** / **Não Aplicável** (`epiNeutralizationLabel`).
  - Ordem canônica exportada: `EPI_NEUTRALIZATION_ORDER` (mesma sequência acima).

## Entidade evoluída: `epi_risk`

### Depois (as-built)

| Campo          | Tipo               | Regras                                                            |
| -------------- | ------------------ | ---------------------------------------------------------------- |
| id             | uuid               | PK                                                               |
| org_id         | text               | NOT NULL → orgs.id (cascade), indexado                           |
| catalog_id     | uuid               | NOT NULL → epi_catalog.id `ON DELETE CASCADE`, indexado          |
| **risk_id**    | uuid               | **NOT NULL → risks.id `ON DELETE CASCADE`, indexado** (era ges_id) |
| **neutralization** | epi_neutralization | **NOT NULL** (era `neutralizes boolean NOT NULL DEFAULT false`) |
| timestamps     | timestamptz        | NOT NULL DEFAULT now() + trigger `set_updated_at_epi_risk`       |

- `UNIQUE(org_id, catalog_id, risk_id)` → `uq_epi_risk_org_catalog_risk` (era `..._ges`).
- Índices: `idx_epi_risk_org_id` (herdado), `idx_epi_risk_catalog_id` (herdado), `idx_epi_risk_risk_id` (novo).
- RLS: policy `epi_risk_isolation` (`app_runtime`, `org_id = current_setting('app.current_org', true)`) — **preservada**.

### Antes (fatia 008, para referência do delta)

`ges_id uuid NOT NULL → ges.id (cascade)`; `neutralizes boolean NOT NULL DEFAULT false`;
`UNIQUE(org_id, catalog_id, ges_id)` = `uq_epi_risk_org_catalog_ges`; `idx_epi_risk_ges_id`.

## Migration `0013_epi_risk_link` (tabela vazia → seguro)

Ordem das operações (ALTER, não recria a tabela → GRANT/trigger/RLS da 008 persistem):

1. `CREATE TYPE epi_neutralization AS ENUM (...)`.
2. `DROP CONSTRAINT epi_risk_ges_id_ges_id_fk` + `DROP INDEX idx_epi_risk_ges_id`, `uq_epi_risk_org_catalog_ges`.
3. `ADD COLUMN risk_id uuid NOT NULL` + `ADD COLUMN neutralization epi_neutralization NOT NULL`.
4. `ADD CONSTRAINT epi_risk_risk_id_risks_id_fk … ON DELETE CASCADE`.
5. `CREATE INDEX idx_epi_risk_risk_id` + `CREATE UNIQUE INDEX uq_epi_risk_org_catalog_risk`.
6. `DROP COLUMN ges_id` + `DROP COLUMN neutralizes`.

- **Sem migração de dados**: a tabela nunca teve consumidores; `ADD COLUMN … NOT NULL` numa tabela
  vazia é seguro. Os nomes de constraint/índice do `DROP` foram conferidos contra `0007_epi_data_model.sql`.
- **Snapshot** derivado do `0012` de forma determinística e validado (`db:generate` → "No schema
  changes"); `prevId` encadeia no `0012`.

## Regras de validação (Zod, em `src/shared/domains/pgr/epi-risk.ts`)

- `epiNeutralizationSchema` = `z.enum(EPI_NEUTRALIZATION_ORDER)` — **obrigatório** (mensagem pt-BR).
- `epiRiskLinkInputSchema` = `{ riskId: uuid, catalogId: uuid, neutralization: epiNeutralizationSchema }`.
- `epiRiskLinkUpdateSchema` = `{ neutralization: epiNeutralizationSchema }`.
- View types: `EpiRiskLinkItem { id, catalogId, name, ca, neutralization }`, `EpiOption { catalogId, name, ca }`.

## Estados / transições

- `neutralization` não tem ciclo de vida temporal — é um atributo editável do vínculo (qualquer um dos
  3 estados a qualquer momento via `updateRiskEpiNeutralization`). Não há default: deve ser escolhido
  na criação.
- Ciclo de vida do vínculo: **criado** (com neutralização) → **editado** (neutralização) → **removido**
  (físico). Sem estados intermediários persistidos.
