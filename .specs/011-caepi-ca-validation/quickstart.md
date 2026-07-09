# Quickstart — Validação/consulta de CA no CAEPI/MTE (fatia 011)

## Pré-requisitos

- `.env.local` com `DATABASE_URL` (runtime, pooler 6543, papel `app_runtime`) e
  `DATABASE_URL_UNPOOLED` (owner, conexão direta — usada por drizzle-kit **e** pelo job).
- Dependências novas instaladas: `npm i -D playwright csv-parse` + `npx playwright install
chromium` (só onde o job roda; a app na Vercel não usa nenhuma das duas).

## 1. Migration (tabela global)

```bash
npm run db:generate   # emite 0009_caepi_certificates a partir do schema
# o drizzle-kit já emite ENABLE RLS + a policy global de leitura (pgPolicy/enableRLS no schema —
# o banco de produção força RLS em tabela nova via event trigger ensure_rls; sem a policy o
# app_runtime leria vazio). Adicionar o SQL custom na migration gerada (padrão 0001/0005):
#   GRANT SELECT ON public.caepi_certificates TO app_runtime;   ← SELECT-only, sem escrita
#   CREATE TRIGGER set_updated_at_caepi_certificates …
npm run db:migrate
```

Verificação manual da exceção (Definição de pronto): conectado como `app_runtime`,
`SELECT` funciona e `INSERT` falha com `permission denied` (42501).

## 2. Bootstrap da base (mesmo script do job — DRY)

```bash
# caminho completo (coleta com browser; exige Chromium instalado):
npx tsx scripts/caepi-sync.ts

# fallback semi-manual / offline (arquivo baixado à mão no portal do MTE):
npx tsx scripts/caepi-sync.ts --file ~/Downloads/RelatorioCA_20260702_120000.csv.gz
```

Saída esperada: logs `operation: "caepi.sync"` com fases e contadores
(`parsed`/`discarded`/`upserted`); exit code `0`. Falha de coleta/gzip → exit ≠ 0 e base intocada.
Rodar 2× seguidas → mesma contagem de linhas (idempotente).

Agendamento (fora do escopo da fatia): o mesmo comando, semanal — recomendação GitHub Actions cron
com `DATABASE_URL_UNPOOLED` como secret.

## 3. Consultar um CA

REST (única superfície testável por cURL/Postman; exige sessão — sem dev-bypass nesta camada):

```bash
curl http://localhost:3000/api/integrations/caepi/31469
# 200 {"ok":true,"data":{"status":"valid","ca":"31469","manufacturer":"…","norm":"…","validUntil":"…"}}
# vencido → data.status = "expired" · inexistente → "not_found" · formato ruim → 422 · sem sessão → 401
```

Postman: folder **CAEPI** na coleção única `docs/api/sst-manager.postman_collection.json`.
Na UI: o campo `ca-field.tsx` (hook `use-caepi-validation`) dispara no blur e autopreenche
fabricante/norma/validade nos estados `valid`/`expired` — nunca bloqueia o salvamento.

## 4. Testes

```bash
npm run check                                    # format + lint + typecheck + unit
INTEGRATION_DATABASE_URL=… \
INTEGRATION_DATABASE_URL_ADMIN=… \
npm run test:integration                         # Postgres EFÊMERO — nunca SQLite/banco de dev
```

- Unit: `parse` (fixture real `caepi-sample.csv.gz`: aspas com `;`/quebra de linha, BOM, acentos,
  linha corrompida, data inválida), `validate-ca` (limite `== hoje` → valid; situação
  vencida/cancelada), `normalize`, mapeamento → `CaLookupResult` (3 estados).
- Integração: upsert idempotente (2×), `getByCa` 3 estados + base vazia, GRANT por papel
  (`app_runtime` lê e não escreve), falha de coleta → base preservada, guarda de sessão (401).
- `collect.ts` não tem unit (browser/rede): validar por execução real no bootstrap — é o spike
  inicial da implementação (headless × Cloudflare).
