# Contract — Schema, Migration e Invariantes Verificáveis

**Feature**: `.specs/023-documents-data-model/` · **Date**: 2026-07-18

Esta fatia não expõe API (sem Server Action, sem REST). Os "contratos" são: (1) a forma da
migration/schema que as fatias #34/#35/#38/#39 consumirão; (2) o contrato SQL de claim da
fila; (3) a assinatura da função pura de validade. Tudo verificável por teste.

## 1. Migration `0025_documents_data_model`

Gerada por `npm run db:generate` a partir de `src/shared/db/schema/{documents,jobs}.ts`;
SQL custom apendado no mesmo arquivo (padrão `0023_schedule_events.sql`). Deve conter, nesta
ordem lógica:

1. `CREATE TYPE` — `document_status`, `job_type`, `job_status`.
2. `CREATE TABLE` — `folders`, `documents`, `jobs` (colunas/constraints conforme
   [data-model.md](../data-model.md)).
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nas 3 tabelas.
4. FKs com ON DELETE conforme o mapa do data-model (CASCADE p/ org; RESTRICT na cadeia de
   pastas).
5. Índices: `idx_*_org_id` (3×), `idx_folders_parent_id`, `idx_documents_folder_id`,
   `idx_documents_org_group`, `idx_documents_related_entity` (parcial),
   `idx_jobs_status_created_at`.
6. UNIQUEs: `uq_folders_org_parent_name` (**NULLS NOT DISTINCT**),
   `uq_documents_org_group_version`.
7. `CREATE POLICY` — `folders_isolation`, `documents_isolation`, `jobs_isolation`
   (`FOR ALL TO app_runtime USING/WITH CHECK (org_id = current_setting('app.current_org',
true))`).
8. **SQL custom**: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO app_runtime` (3×) +
   `CREATE TRIGGER set_updated_at_<tabela>` (3×, com `DROP TRIGGER IF EXISTS` antes).

**Nenhuma policy além das de isolamento** (decisão research §6). Nenhum GRANT a outro role.

## 2. Contrato de claim da fila (consumido pela #39)

Claim atômico — exatamente um processador obtém um job pendente:

```sql
UPDATE jobs
SET status = 'processing', locked_at = now(), attempts = attempts + 1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'pending'
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

Recuperação de claim travado (processador morto):

```sql
UPDATE jobs
SET status = 'pending', locked_at = NULL
WHERE status = 'processing' AND locked_at < now() - $1::interval;
```

Regras de consumo:

- O claim/leitura administrativa roda **fora** do `app_runtime` (conexão server-only;
  precedentes `caepi-upsert.ts` / `admin.ts`) — decisão final de mecanismo é da #39.
- Toda escrita de **resultado** do job (ex.: inserir `documents` gerados) usa
  `withOrg(job.org_id)` — nunca a conexão administrativa.
- Falha de processamento: `status = 'failed'` + erro estruturado em `result` (nunca
  silencioso).

**Testes de integração devem provar**: (a) dois claims concorrentes sobre 1 job pendente →
exatamente um obtém (transações paralelas no Postgres efêmero); (b) job `processing` com
`locked_at` antigo é retornado a `pending` pela query de recuperação; (c) `attempts`
incrementa a cada claim.

## 3. Função pura de validade (consumida pela #34/#35 e dashboard)

`src/shared/domains/documents/validity.ts`:

```ts
export type DocumentValidityStatus = "ok" | "due_soon" | "expired" | "no_expiry";

export function classifyDocumentValidity(
  validUntil: string | null, // date ISO (YYYY-MM-DD) ou null
  opts: { today: string; dueWindowDays: number },
): DocumentValidityStatus;

export const documentRelatedEntityTypeSchema = z.enum(["pgr"]);
export type DocumentRelatedEntityType = z.infer<typeof documentRelatedEntityTypeSchema>;
```

Semântica (espelho de `classifyTrainingStatus`, 017): `null` → `no_expiry`;
`validUntil < today` → `expired`; `validUntil <= today + dueWindowDays` → `due_soon`; senão
`ok`. Comparação lexicográfica de datas ISO; `today` produzido por `todayInSaoPaulo()`
(`src/shared/dates.ts`); janelas aceitas reusam `DUE_WINDOW_DAYS_OPTIONS` (30/60/90),
**promovido** de `domains/pgr/trainings.ts` para `src/shared/dates.ts` nesta fatia (re-export
mantido em `trainings.ts` para compat) — evita import cross-domain `documents → pgr`.

**Testes unitários devem cobrir**: sem validade; vencido ontem; vence hoje (não vencido —
inclusivo, mesmo racional da 017); dentro e fora da janela; borda exata da janela.

## 4. Isolamento (padrão `tenant_probe` — as 3 tabelas)

Testes de integração no Postgres efêmero devem provar, por tabela:

- leitura como `app_runtime` **sem** `app.current_org` → 0 linhas;
- leitura com org A → só linhas de A;
- INSERT/UPDATE marcado para org B com GUC = A → rejeitado pelo `WITH CHECK`;
- unicidades: pasta irmã duplicada (incl. duas pastas raiz de mesmo nome, mesma org) →
  violação; mesma dupla (grupo, versão) na mesma org → violação; mesmos nomes em orgs
  distintas → aceitos.
