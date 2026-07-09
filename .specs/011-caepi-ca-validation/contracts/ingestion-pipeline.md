# Contract — Pipeline de ingestão CAEPI (collect → parse → upsertMany)

Duas responsabilidades decopladas pelo **arquivo `.csv.gz`** (anti-corruption layer): só a coleta
conhece Cloudflare/ASP.NET; só o ingestor conhece CSV/banco. Fonte: spec FR-030..040, research
R2/R4/R5/R11/R12.

## `collect.ts` — coleta com browser (único passo frágil)

```ts
/** Baixa a base oficial do CAEPI. Retorna o caminho do .csv.gz salvo em disco. */
export async function collectCaepiFile(opts?: { outDir?: string }): Promise<string>;
```

- Playwright/Chromium **real** (headless novo; user-agent/locale pt-BR coerentes): abre
  `https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx` (resolve o desafio Cloudflare),
  dispara o postback `__doPostBack('ctl00$PlaceHolderConteudo$LinkButton1','')` e captura o
  download (`RelatorioCA_AAAAMMDD_HHMMSS.csv.gz`, `application/gzip`).
- **Pós-condições**: arquivo existe, não-vazio, com assinatura gzip `1f 8b 08`. Qualquer outra
  situação (desafio não resolvido, timeout, download ausente, assinatura inválida) → **lança**
  `CollectError` com mensagem descritiva. Nunca devolve caminho de arquivo suspeito.
- **Garantia de contenção**: nenhum outro módulo importa Playwright nem conhece a URL/postback;
  trocar a origem (fallback/Plano B) toca só este arquivo.
- Sem teste unitário (browser/rede); validado por execução real (spike R2 é a primeira tarefa da
  implementação).

## `parse.ts` — função pura, streaming

```ts
export type ParseStats = { parsed: number; discarded: number };

/**
 * Gunzip + CSV em streaming. Consome um Readable do .csv.gz e emite lotes de
 * linhas tipadas. `onDiscard` recebe (motivo, nº da linha) para log/contador.
 */
export async function parseCaepiCsv(
  gzipStream: NodeJS.ReadableStream,
  onBatch: (rows: CaepiParsedRow[]) => Promise<void>,
  opts?: { batchSize?: number; onDiscard?: (reason: string, line: number) => void },
): Promise<ParseStats>;
```

- Pipeline: `zlib.createGunzip()` → `csv-parse` (`delimiter: ";"`, `bom: true`, aspas/escape
  RFC 4180, `relax_column_count: true`) → validação Zod por linha → normalizações (`ca` só
  dígitos; `DATA DE VALIDADE` `dd/mm/aaaa` → `YYYY-MM-DD`).
- **Descarte por linha, nunca aborto**: linha corrompida/colunas faltando/data inválida/`ca`
  inválido → descartada com log e contada em `discarded`; a carga continua (FR-032).
- **Pura no sentido da spec**: sem I/O próprio (recebe stream, devolve dados via callback) —
  testável em unit com a fixture real `caepi-sample.csv.gz` (aspas com `;`/`\n` internos, BOM,
  acentos, linha corrompida, data inválida).
- `batchSize` default **1.000** (casa com o chunk do upsert — R5).

## `upsertMany` — escrita idempotente (repositório do job)

Ver [repositories.md](./repositories.md). Resumo: `INSERT … ON CONFLICT (ca) DO UPDATE` por chunk,
handle Drizzle **injetado** (conexão owner), mesmo `synced_at` para toda a execução.

## `scripts/caepi-sync.ts` — orquestração (job = bootstrap = fallback)

```
npx tsx scripts/caepi-sync.ts            # fluxo completo: collect → parse → upsertMany
npx tsx scripts/caepi-sync.ts --file X   # fallback semi-manual/CI: ingere X (.csv.gz) sem coleta
```

- Env: `DATABASE_URL_UNPOOLED` (conexão owner — mesma classe do drizzle-kit), carregada via
  `dotenv` (`.env.local` → `.env`). Segredo nunca commitado; no agendador, vem de secret.
- **Sequência**: (1) resolve o arquivo (collect **ou** `--file`); (2) valida gzip; (3) abre o
  client owner (`drizzle(postgres(DATABASE_URL_UNPOOLED))`); (4) `parseCaepiCsv` com `onBatch` →
  `upsertMany`; (5) log de fechamento com `parsed/discarded/upserted/durationMs`.
- **Fail-safe (FR-036)**: falha na coleta/gzip acontece **antes de qualquer escrita** → base
  intocada. `parsed === 0` (zero linhas válidas) → **falha** (layout novo da fonte não pode passar
  por carga vazia bem-sucedida — R12).
- **Falha alto**: qualquer erro → log estruturado (`operation: "caepi.sync"`, fases
  `start|collect|parse|upsert|finish`) + **exit code ≠ 0** (o agendador transforma em alerta).
- **Idempotência**: rodar N× = 1× (upsert por `ca`); reexecução após falha parcial conserta a
  carga (R5).
- **Cadência**: semanal (Clarifications); o agendamento em si (GitHub Actions cron recomendado) é
  decisão de infra fora do escopo — o contrato do script não depende do agendador.
- **Proibições**: sem Route Handler `/api/cron`, sem `CRON_SECRET`, sem truncate/delete, sem uso
  da conexão runtime (`DATABASE_URL`/`app_runtime`) para escrita.
