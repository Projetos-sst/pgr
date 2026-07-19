# Data Model — Documentos, Pastas e Jobs

**Feature**: `.specs/023-documents-data-model/` · **Date**: 2026-07-18
**Migration**: `0025_documents_data_model` · **Schema files**: `src/shared/db/schema/documents.ts` (folders + documents), `src/shared/db/schema/jobs.ts`

Padrão transversal (todas as tabelas): PK `id uuid DEFAULT gen_random_uuid()`;
`org_id text NOT NULL → orgs.id ON DELETE CASCADE` indexado; `created_at`/`updated_at
timestamptz NOT NULL DEFAULT now()` + trigger `set_updated_at`; RLS habilitado com policy única
`<tabela>_isolation FOR ALL TO app_runtime USING/WITH CHECK (org_id =
current_setting('app.current_org', true))`; `GRANT SELECT, INSERT, UPDATE, DELETE TO
app_runtime`.

## Enums

| Enum              | Valores                                   | Uso                                                                           |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| `document_status` | `generating`, `ready`                     | ciclo de vida do documento (default `ready`); `generating` é gravado pela #38 |
| `job_type`        | `pdf_batch`                               | único consumidor previsto (#39); ampliável por migration                      |
| `job_status`      | `pending`, `processing`, `done`, `failed` | máquina de estados da fila                                                    |

## Tabela `folders`

| Coluna                      | Tipo                 | Regras                                                                      |
| --------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `id`                        | uuid PK              | `gen_random_uuid()`                                                         |
| `org_id`                    | text NOT NULL        | → `orgs.id` CASCADE; `idx_folders_org_id`                                   |
| `parent_id`                 | uuid NULL            | → `folders.id` **ON DELETE RESTRICT**; NULL = raiz; `idx_folders_parent_id` |
| `name`                      | text NOT NULL        | —                                                                           |
| `created_at` / `updated_at` | timestamptz NOT NULL | default `now()`; trigger                                                    |

**Constraints**:

- `uq_folders_org_parent_name`: `UNIQUE (org_id, parent_id, name)` **NULLS NOT DISTINCT** —
  unicidade entre irmãs vale também na raiz (FR-007).
- RLS `folders_isolation` (padrão transversal).

**Estados/transições**: sem máquina de estados; árvore por auto-referência (FR-006).

## Tabela `documents`

| Coluna                      | Tipo                                         | Regras                                                                                        |
| --------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`                        | uuid PK                                      | `gen_random_uuid()`                                                                           |
| `org_id`                    | text NOT NULL                                | → `orgs.id` CASCADE; `idx_documents_org_id`                                                   |
| `folder_id`                 | uuid NULL                                    | → `folders.id` **ON DELETE RESTRICT**; NULL = raiz; `idx_documents_folder_id`                 |
| `document_group_id`         | uuid NOT NULL                                | agrupa as versões do mesmo documento lógico (research §1); gerado pela aplicação na 1ª versão |
| `name`                      | text NOT NULL                                | —                                                                                             |
| `doc_type`                  | text NOT NULL                                | texto livre (Q2/FR-004)                                                                       |
| `version`                   | integer NOT NULL DEFAULT 1                   | CHECK `version >= 1`                                                                          |
| `status`                    | `document_status` NOT NULL DEFAULT `'ready'` | **ciclo de vida**, não validade (FR-002)                                                      |
| `storage_path`              | text NOT NULL                                | referência opaca do arquivo (particionamento por tenant é da #34/#37)                         |
| `size_bytes`                | bigint NOT NULL                              | CHECK `size_bytes >= 0`; Drizzle `mode: "number"` (research §8)                               |
| `valid_until`               | date NULL                                    | NULL = sem validade (fora da classificação)                                                   |
| `related_entity_type`       | text NULL                                    | conjunto fechado na aplicação (`pgr`, zod) — FR-005                                           |
| `related_entity_id`         | uuid NULL                                    | sem FK (polimórfico)                                                                          |
| `created_at` / `updated_at` | timestamptz NOT NULL                         | default `now()`; trigger                                                                      |

**Constraints e índices**:

- `uq_documents_org_group_version`: `UNIQUE (org_id, document_group_id, version)` (FR-003).
- `idx_documents_org_group`: `(org_id, document_group_id)` — leitura do grupo/versão corrente.
- `documents_related_entity_check`: CHECK
  `(related_entity_type IS NULL) = (related_entity_id IS NULL)` — vínculo completo-ou-vazio.
- `idx_documents_related_entity` (parcial): `(org_id, related_entity_type, related_entity_id)
WHERE related_entity_type IS NOT NULL` — consulta por entidade (US3).
- RLS `documents_isolation` (padrão transversal).

**Derivações (leitura, nunca coluna)**:

- Versão corrente do grupo = `MAX(version)` por `(org_id, document_group_id)`.
- Status de validade = `classifyDocumentValidity(valid_until, { today, dueWindowDays })` —
  função pura em `src/shared/domains/documents/validity.ts`; `today` via `todayInSaoPaulo()`;
  retorno `ok | due_soon | expired | no_expiry` (FR-002/SC-004).

## Tabela `jobs`

| Coluna                      | Tipo                                      | Regras                                                         |
| --------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `id`                        | uuid PK                                   | `gen_random_uuid()`                                            |
| `org_id`                    | text NOT NULL                             | → `orgs.id` CASCADE; `idx_jobs_org_id`                         |
| `job_type`                  | `job_type` NOT NULL                       | —                                                              |
| `status`                    | `job_status` NOT NULL DEFAULT `'pending'` | —                                                              |
| `payload`                   | jsonb NOT NULL DEFAULT `'{}'`             | entrada estruturada do job                                     |
| `result`                    | jsonb NULL                                | resultado de sucesso **ou** erro estruturado (FR-009)          |
| `attempts`                  | integer NOT NULL DEFAULT 0                | CHECK `attempts >= 0`; incrementa no claim                     |
| `locked_at`                 | timestamptz NULL                          | carimbo de reivindicação; base da recuperação de claim travado |
| `created_at` / `updated_at` | timestamptz NOT NULL                      | default `now()`; trigger                                       |

**Índices**: `idx_jobs_status_created_at`: `(status, created_at)` — poll da fila em ordem de
chegada. RLS `jobs_isolation` (padrão transversal).

**Máquina de estados**:

```
pending ──claim──▶ processing ──sucesso──▶ done
   ▲                   │
   └──stale/falha──────┴──falha registrada──▶ failed
```

- **Claim** (atômico, contrato em `contracts/schema-and-migrations.md`): `pending →
processing`, seta `locked_at = now()`, `attempts += 1`, via `FOR UPDATE SKIP LOCKED` —
  exatamente um processador obtém o job (SC-003).
- **Stale claim**: `processing` com `locked_at < now() - limite` → retornável a `pending`
  (o `attempts` acumulado registra o histórico).
- **Falha**: `processing → failed` com erro em `result`; payload malformado falha registrado,
  nunca silencioso (edge case do spec).

## Invariantes de aplicação (documentados — o banco não impede)

1. **Ciclo de pastas**: mover pasta para dentro de si mesma/descendente é proibido; a #34
   valida subindo a cadeia de `parent_id` antes do UPDATE.
2. **Conjunto fechado do vínculo polimórfico**: `related_entity_type ∈ {"pgr"}` via zod;
   ampliar = editar o schema zod, sem migration.
3. **Grupo de versões**: `document_group_id` é gerado pela aplicação na criação da 1ª versão e
   reusado nas seguintes com `version = MAX+1` (a #34 implementa; o banco garante a unicidade).
4. **Escrita de resultado de job**: sempre `withOrg(job.org_id)` — o acesso administrativo é
   somente leitura/claim (FR-011).
5. **Teto de tentativas**: o modelo não impõe `max_attempts` — a política de desistência
   (quando parar de re-claimar um job que falha sempre) é do worker (#39), via config/payload;
   `attempts` só registra o histórico.

## Relações (resumo ON DELETE)

| FK                                 | ON DELETE | Racional                                         |
| ---------------------------------- | --------- | ------------------------------------------------ |
| `*.org_id → orgs.id`               | CASCADE   | padrão do repo — remoção do tenant leva os dados |
| `folders.parent_id → folders.id`   | RESTRICT  | pasta com subpastas não some (Q3)                |
| `documents.folder_id → folders.id` | RESTRICT  | pasta com documentos não some (Q3)               |
| `documents.related_entity_* `      | (sem FK)  | polimórfico; integridade na aplicação (US3)      |
