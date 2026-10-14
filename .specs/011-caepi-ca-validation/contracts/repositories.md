# Contract — Repositórios CAEPI

Todo o SQL da fatia vive nestes dois módulos (Repository pattern). Divisão **por contexto de
execução** (research R4): leitura no runtime da app (papel `app_runtime`, GRANT SELECT-only) vs
escrita no job (conexão owner injetada; o script tsx não pode importar o singleton `db`, que
carrega `server-only`).

## `src/shared/db/repositories/caepi.ts` — leitura (runtime)

```ts
export type CaepiCertificate = InferSelectModel<typeof caepiCertificates>;

export type GetByCaResult =
  | { record: CaepiCertificate }
  | { record: null; baseEmpty: boolean };

/** SELECT por PK na tabela global. SEM withOrg — dado público (exceção documentada). */
export async function getByCa(ca: string): Promise<GetByCaResult>;
```

- Usa o singleton `db` (pooler, `app_runtime`). **Nunca** `withOrg`/tenant — comentário no código
  aponta a exceção (spec FR-007/FR-020).
- `ca` já chega normalizado (só dígitos) — a validação de formato acontece na surface (FR-002).
- `baseEmpty`: quando não encontra, o repositório informa se a tabela está vazia
  (`SELECT EXISTS`/count barato) para a surface distinguir "CA não existe" de "base nunca
  sincronizada" (FR-006) sem segunda ida ao banco pelas camadas de cima.
- **Garantia**: somente SELECT. Qualquer tentativa de escrita por esta conexão falharia pelo GRANT
  (backstop testado na integração).

## `src/shared/db/repositories/caepi-upsert.ts` — escrita (job)

```ts
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Upsert idempotente por `ca`. Handle INJETADO (conexão owner/unpooled do script).
 * NÃO importa server-only nem o singleton db.
 */
export async function upsertMany(
  db: PostgresJsDatabase<Record<string, never>>,
  rows: CaepiParsedRow[],
  syncedAt: Date,
): Promise<{ upserted: number }>;
```

- `INSERT INTO caepi_certificates … ON CONFLICT (ca) DO UPDATE SET` (todas as colunas de dado +
  `synced_at`; `updated_at` fica com a trigger). Chunks de ~1.000 linhas por statement (R5).
- **Idempotência**: mesmas linhas 2× → estado final idêntico, zero duplicatas (PK `ca`).
- **Sem delete/truncate** — vencido/cancelado é atualização de `situation` (FR-035).
- Duplicata de `ca` dentro do mesmo lote: vence a última ocorrência (documentado no
  data-model §2 — comportamento natural do upsert sequencial).
- Consumidores: `scripts/caepi-sync.ts` (produção, client owner próprio) e o teste de integração
  (client `adminClient()` do harness `_helpers/db.ts`).

## Garantias transversais (testadas na integração, Postgres efêmero)

1. **GRANT por papel**: com o client `app_runtime`, `SELECT` funciona e
   `INSERT`/`UPDATE`/`DELETE` em `caepi_certificates` são negados (SQLSTATE 42501). Com o client
   admin/owner, o upsert funciona. (US3)
2. **Idempotência**: `upsertMany` 2× com a mesma carga → mesma contagem de linhas, mesmos valores;
   update in-place comprovado alterando `situation`/`valid_until` entre execuções. (US2-5/8)
3. **Fail-safe**: carga simulada que falha antes do upsert (gzip truncado via `--file` com fixture
   corrompida) não altera a base semeada. (US2-6)
4. **3 estados**: `getByCa` com base semeada → registro vigente/vencido/ausente; base vazia →
   `{ record: null, baseEmpty: true }`. (US1)
