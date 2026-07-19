# Plan — Batch PDF Worker (fatia #39)

**Branch**: `release/0.2.0` (sem push) · **Date**: 2026-07-19 · **Sem migration** (fila `jobs` é da 023).

Gate do CTO fechado nos 5 pontos:

1. **`server-only` no worker** → `node --conditions=react-server` (noop oficial do pacote; zero build config).
2. **Idempotência** → enqueue pré-cria `documents` em `generating` + upload determinístico `upsert`.
3. **Payload** → **1 job por documento**: `{ documentId, kind: "pgr", pgrId }`.
4. **Fronteira #38** → documento único é síncrono inline; **só lote** passa pela fila.
5. **Backoff** → MVP sem delay (re-claim no próximo poll); **sem** coluna `next_attempt_at`.

## Arquitetura

- **Worker**: processo Node standalone long-lived (`worker/index.ts`), **sequencial** (sem `p-limit` — YAGNI; concorrência é tuning futuro). Loop: `recoverStale → claim → process → mark`. `SIGTERM`/`SIGINT` graceful. Roda com `node --conditions=react-server --import tsx`.
- **Conexões** (contrato 023): **claim/reaper/status do job** via handle **owner** injetado (`DATABASE_URL_UNPOOLED`; padrão `caepi-upsert` — sem `server-only`, cross-tenant); **escrita do resultado** sempre `withOrg(job.org_id)` (app_runtime + RLS).
- **Claim**: `SELECT id … WHERE status='pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1` → `UPDATE … status='processing', locked_at=now(), attempts+=1` (transação; drizzle `.for('update',{skipLocked:true})`).
- **Stale**: `processing` com `locked_at < now() - WORKER_STALE_AFTER_SECONDS` → `pending`.
- **Retry**: falha com `attempts < WORKER_MAX_ATTEMPTS` → `pending`; senão `failed` + erro em `result`.
- **Idempotência**: enqueue insere `documents{id, status:'generating', storage_path=<det>}` + `jobs{payload}`. Worker: `htmlToPdf` → `putGeneratedPdf` (path `<org>/documentos/generated/<documentId>.pdf`, `upsert:true`) → `withOrg` `UPDATE documents SET status='ready', size_bytes, name`. Reprocessar sobrescreve o objeto e re-atualiza a linha — sem duplicar.
- **Vercel Cron**: substituído no processamento (worker self-poll); enqueue via Server Action mantido; `CRON_SECRET`/route de cron não usados.

## Arquivos

- `worker/index.ts` (loop), `worker/owner-db.ts` (client owner).
- `src/shared/domains/documents/pdf-batch.ts` (payload zod).
- `src/shared/db/repositories/jobs-admin.ts` (owner-injected: claim/reaper/status).
- `src/shared/db/repositories/pdf-batch.ts` (enqueue: documents generating + job, `withOrg`).
- `src/shared/server/platform/pdf-batch-core.ts` (`processPdfBatchJob`, server-only).
- `src/shared/server/actions/documents/pdf-batch.ts` (`enqueuePgrPdfBatchAction`).
- `src/shared/integrations/storage/documents-storage.ts` (+`generatedPdfPath`/`putGeneratedPdf`).
- `Dockerfile.worker` + serviço `worker` no `docker-compose.yml` + script `worker`.

## Testes (Postgres efêmero — nunca SQLite)

- **Unit**: payload zod; `processPdfBatchJob` (deps mockadas) — orquestração + idempotência (path determinístico estável).
- **Integração**: claim concorrente (1 vence), stale reaper, `attempts` incrementa/retry, enqueue cria `generating`+job (cross-tenant isolado), idempotência do write de resultado (2× → 1 `ready`).
