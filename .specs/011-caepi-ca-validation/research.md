# Research — Validação/consulta de CA no CAEPI/MTE (fatia 011)

**Input**: [spec.md](./spec.md) · anexos `docs/briefings/caepi-cron-brainstorming.md` (Spike 0),
`115-caepi-validacao-ca.md`, `caepi-logica-de-negocio.md` · padrões vigentes em
`src/shared/integrations/**`, `src/app/api/integrations/**`, `src/shared/db/**`.

Sem `NEEDS CLARIFICATION` pendente na spec (Clarifications de 2026-07-02 resolveram gate, cadência
e #75). Este research fecha as decisões **técnicas** que a spec deixou para o plan.

---

## R1 · Parser CSV: `csv-parse` (streaming)

- **Decision**: usar **`csv-parse`** (pacote do projeto `csv` para Node) em modo streaming, com
  `delimiter: ";"`, `quote: '"'`, `escape: '"'` (escape `""` é o default RFC 4180), `bom: true`
  (remove o BOM UTF-8), `relax_column_count: true` + validação Zod por linha (linha com contagem
  errada/valores inválidos é descartada com log pelo nosso código, não pelo parser).
- **Rationale**: é o parser CSV maduro de referência no ecossistema Node, com **API de stream
  nativa** (compõe com `zlib.createGunzip()`), suporte correto a `;`/quebras de linha dentro de
  aspas e a BOM — exatamente os requisitos do FR-031. A spec proíbe parse manual.
- **Alternatives considered**: **papaparse** (foco browser; API de stream em Node menos natural);
  **fast-csv** (equivalente, menos adotado); **split por `;`** (proibido — corrompe campos com
  `;`/`\n` internos, provado na amostra real do Spike 0).

## R2 · Coleta: `playwright` (Chromium) + plano para o risco headless

- **Decision**: `collect.ts` usa **Playwright** com Chromium real (não `--headless=old`),
  user-agent/locale coerentes (pt-BR) e espera pelo evento de **download** após disparar o
  postback (`__doPostBack('ctl00$PlaceHolderConteudo$LinkButton1','')`) na página
  `internet/ConsultaCAInternet.aspx`. Saída: caminho do `.csv.gz` salvo em disco (dir temporário).
  Falha (desafio não resolvido, timeout, download ausente, assinatura gzip inválida `1f 8b 08`) →
  lança erro descritivo; o script trata como falha alta (fail-safe, base intocada).
- **Risco residual (headless em IP de datacenter)**: tratado como **primeira tarefa da
  implementação** (spike curto): rodar `collect.ts` num runner de CI antes de construir o resto em
  cima. Se não passar de forma estável, o caminho oficial vira a **ingestão semi-manual** já
  suportada pelo desenho (`--file`, ver R11) — zero retrabalho (só a coleta é substituída).
- **Rationale**: fato do Spike 0 — Cloudflare com desafio JS devolve 403 a cliente não-browser;
  browser headed passou. Playwright é o padrão do repo (MCP/testing docs) e roda fácil em CI.
- **Alternatives considered**: **fetch/undici/curl** (provadamente bloqueados); **puppeteer**
  (equivalente, sem vantagem); **replicar `cf_clearance` por engenharia reversa** (frágil,
  descartado por decisão travada); **API paga de terceiros** (Plano B registrado, não implementado).
- **RESULTADO DO SPIKE (T018, 2026-07-02, execução real)**:
  - **Headless NÃO passa** o desafio Cloudflare em nenhuma variante testada (headless shell,
    headless novo do Chromium completo via `channel: "chromium"`, Chrome real headless) — a página
    fica presa em "Um momento…". **Headed passa** (Chromium e Chrome), mesmo automatizado.
    Consequência: `collect.ts` roda **headed por default** (`headless: false`); em runner de CI
    exigiria display virtual (xvfb) e ainda assim IP de datacenter é risco — o caminho recomendado
    para agendamento é rodar com display (ou usar o fallback `--file`, zero retrabalho).
  - **Id real do link** no DOM: `#PlaceHolderConteudo_LinkButton1` (o ASP.NET emite o anchor SEM o
    prefixo `ctl00_` do UniqueID usado no `__doPostBack`).
  - **Fatos novos do arquivo real** (`RelatorioCA_20260702_100356.csv.gz`, 22,4 MB → 149,8 MB
    descomprimido, 124.317 registros): (a) o corpo da resposta traz o **HTML da página ASPX
    (~885 KB) anexado DEPOIS do stream gzip** — o zlib do Node descarta o output do chunk final ao
    tocar nesse lixo; `parse.ts` trunca o stream bruto no marcador `\r\n\r\n<!DOCTYPE html` antes
    do gunzip (backstop: CRC do gzip falha alto se o corte sair errado); (b) o CSV começa com
    **BOM DUPLO** (`efbbbf` 2×); (c) parse real completo: 124.316 linhas válidas, 0 descartes.

## R3 · Runner do script: `tsx` + `dotenv` (já no repo)

- **Decision**: o job roda com `npx tsx scripts/caepi-sync.ts` (tsx `^4` já é devDependency),
  carregando env com `dotenv` (`.env.local` → `.env`, mesmo padrão do `drizzle.config.ts`).
  Nenhum runner novo.
- **Rationale**: zero dependência nova para executar TS fora do Next; o mesmo comando serve para
  bootstrap manual, fallback semi-manual e agendador (GitHub Actions cron recomendado — decisão de
  infra do time, fora do escopo).
- **Alternatives considered**: `ts-node` (também presente, mas tsx é mais rápido e sem config);
  compilar para JS (passo extra sem ganho); Route Handler + Vercel Cron (**descartado por decisão
  travada** — serverless não roda Chromium nem comporta a carga no timeout).

## R4 · Conexões e divisão do repositório por contexto de execução

- **Decision**:
  - **Leitura (runtime)**: `src/shared/db/repositories/caepi.ts` → `getByCa(ca)` usando o
    singleton `db` (pooler, papel `app_runtime`), **sem `withOrg`** (tabela global — exceção
    documentada). SELECT por PK.
  - **Escrita (job)**: `src/shared/db/repositories/caepi-upsert.ts` → `upsertMany(dbHandle, rows,
syncedAt)` com o handle Drizzle **injetado** e **sem** importar `src/shared/db/index.ts`. O
    script cria seu próprio client: `drizzle(postgres(DATABASE_URL_UNPOOLED))` (conexão
    owner/unpooled — a mesma classe de conexão do drizzle-kit).
- **Rationale**: (a) segurança — `app_runtime` tem GRANT SELECT-only na tabela; a escrita **tem**
  de vir da conexão owner (FR-023); (b) mecânica — `db/index.ts` importa `server-only`, que
  **lança** quando importado fora do ambiente React Server (o script tsx quebraria); o handle
  injetado mantém todo o SQL no diretório de repositórios (Repository pattern) sem contaminar o
  script com detalhes de query, e torna `upsertMany` testável na integração com o client admin do
  harness (`_helpers/db.ts#adminClient`).
- **Alternatives considered**: um único arquivo de repositório importando `db` (quebra o script
  via `server-only`); script com SQL inline (viola Repository pattern); dar INSERT/UPDATE ao
  `app_runtime` (viola FR-022/US3 — enfraquece a contenção da exceção).

## R5 · Upsert em chunks, sem transação global

- **Decision**: `upsertMany` grava em lotes de **1.000 linhas** por `INSERT … ON CONFLICT (ca) DO
UPDATE` (Drizzle `onConflictDoUpdate`), **sem** transação englobando a carga inteira. Todas as
  linhas de uma execução recebem o **mesmo `synced_at`** (timestamp do início do job).
- **Rationale**: 10 colunas × 1.000 linhas = ~10k parâmetros por statement (folga sob o limite de
  65.534 do Postgres) e memória constante em streaming. Sem transação global porque: o upsert
  nunca deixa a base vazia (não há truncate); uma falha no meio deixa a base **mista porém
  consistente por linha** (cada CA é atômico) e a **reexecução idempotente conserta** — mais
  simples e mais barato que segurar uma transação longa sobre a base nacional (KISS). O fail-safe
  exigido pela spec (FR-036) é sobre **falha de coleta/gzip** — nesses casos o script falha
  **antes** de qualquer escrita.
- **Alternatives considered**: transação única (WAL/locks longos sem necessidade — a atomicidade
  por linha + idempotência já dão a garantia que importa); staging table + swap (over-engineering
  para uma base de referência); `p-limit`/paralelismo de lotes (YAGNI — vazão sequencial resolve;
  revisitar só se o bootstrap real ficar lento demais).

## R6 · "Hoje" e regra de estado (`validate-ca`)

- **Decision**: `validateCa(record, today)` é **pura** e recebe `today` como `YYYY-MM-DD`
  (testável; produção deriva o valor no fuso **`America/Sao_Paulo`** via
  `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`). Regra:
  - `valid` ⇔ registro existe **e** `situation` normalizada = `VALIDO` **e** `valid_until >=
today` (comparação lexicográfica de `YYYY-MM-DD`; limite **inclusivo** — `== today` é
    `valid`).
  - `expired` ⇔ registro existe e qualquer outra combinação (`valid_until < today` **ou**
    `situation` ≠ VALIDO — VENCIDO/CANCELADO ou valor futuro desconhecido, postura conservadora).
  - `not_found` ⇔ sem registro (inclui base vazia; a surface acrescenta o aviso "base CAEPI ainda
    não sincronizada" quando a tabela está vazia).
  - Normalização de `situation`: uppercase + remoção de acentos (NFD) — `VÁLIDO` → `VALIDO` —
    para não depender de acentuação/caixa da fonte.
- **Rationale**: o servidor (Vercel) roda em UTC; à noite, UTC já virou o dia seguinte e um CA que
  vence "hoje" no Brasil seria marcado vencido cedo demais — o dado é regulatório brasileiro, o
  fuso de referência é o do Brasil. Situação desconhecida tratada como `expired` (não `valid`)
  porque o custo do falso-válido (autofill com selo verde num CA cancelado) é maior que o do
  falso-vencido (aviso que o usuário pode ignorar — nunca bloqueia).
- **Alternatives considered**: `new Date()` UTC direto (bug de fuso no limite do dia); lib de
  datas (YAGNI — comparação de strings ISO basta); tratar situação desconhecida como `valid`
  (inverte o risco errado).

## R7 · Hook reusa `useLookup` → REST; 3 estados como payload 200

- **Decision**: `use-caepi-validation` **envolve o `useLookup` existente** (`isValid: isValidCa`,
  `buildUrl: /api/integrations/caepi/${ca}`, `onFound`), derivando o estado exposto
  (`valid`/`expired`/`not_found`) do campo `status` do payload quando o fetch dá `success`. O REST
  devolve os **3 estados com HTTP 200** (`ok(CaLookupResult)`); `VALIDATION` 422 e `UNAUTHORIZED`
  401 seguem como erro.
- **Rationale**: é isto que fecha a decisão de Clarifications: o `useLookup` só entrega dado ao
  chamador quando `response.ok && body.ok` — se `not_found` fosse 404 (molde CEP), o hook o veria
  como `error` genérico e a UI não conseguiria distinguir "não encontrado" (aviso de negócio) de
  "serviço falhou" (silencioso). Com payload 200, o hook herda de graça o AbortController, o
  gatilho só-com-formato-válido e o nunca-lançar do padrão CEP/CNPJ (DRY).
- **Alternatives considered**: 404 para `not_found` + hook custom com fetch próprio (duplica o
  `useLookup` para contornar uma decisão nossa de status code); Server Action no hook (não
  abortável por AbortController e fora do molde da camada).

## R8 · Server Action `lookupCa`: guarda de sessão inline (sem wrapper novo)

- **Decision**: `lookup-ca.ts` implementa a Server Action diretamente: `requireAuth()` →
  `isValidCa`/`normalizeCa` (senão `fail("VALIDATION")`) → serviço `lookupCaRecord` → `ok(result)`;
  erros conhecidos mapeados por `toActionError` (`UNAUTHORIZED` etc.), inesperados relançados
  (padrão `officeAction`). **Não** criar um wrapper genérico `sessionAction`.
- **Rationale**: só existe **um** consumidor session-gated hoje (YAGNI/regra do repo: abstrair com
  2+ consumidores reais). `officeAction` não serve — exige staff/tenant (a Clarification fixou
  sessão-apenas). A lógica de negócio fica no serviço compartilhado `lookup.ts`, então a action é
  só orquestração fina (endpoint orquestra, service executa).
- **Alternatives considered**: `officeAction` (gate errado pós-Clarification); wrapper
  `sessionAction` genérico (abstração especulativa — promover quando surgir o segundo consumidor).

## R9 · Formato de CA (`isValidCa`)

- **Decision**: válido ⇔ após `normalizeCa` (= `onlyDigits`, reusado de
  `integrations/validation.ts`) restam **1 a 10 dígitos** e o original não contém letras (aceita
  máscara/espaços/pontuação leve). O valor consultado/armazenado é a string de dígitos (sem strip
  de zeros à esquerda — chave textual idêntica à da fonte).
- **Rationale**: CAs reais têm ~5–6 dígitos, mas o teto folgado (10) evita quebrar quando a
  numeração crescer; o piso (1 dígito, não vazio) cumpre o FR-002 sem inventar regra que o MTE não
  publica. Dígito verificador não existe para CA.
- **Alternatives considered**: regex estrita `^\d{5,6}$` (quebraria com numeração futura e com CAs
  antigos curtos); aceitar qualquer string (violaria FR-002 e dispararia consultas inúteis).

## R10 · Tabela: PK natural `ca`; sem `TtlCache`; nascida fechada para a Data API

- **Decision**: `caepi_certificates` usa **`ca text` como PRIMARY KEY** (chave natural = alvo do
  upsert = chave da consulta; sem uuid sintético). Colunas conforme mapa D8 (detalhe em
  `data-model.md`): `valid_until date NOT NULL`, `situation text NOT NULL`, demais campos `text`
  anuláveis, `synced_at timestamptz NOT NULL`, `created_at`/`updated_at`. A consulta **não** usa o
  `TtlCache` da camada (o SELECT local por PK já é o "cache" da fonte externa; cache em memória
  serverless seria camada morta). Data API: a migration `0006` já revogou os privilégios default
  de `anon`/`authenticated` para tabelas futuras — a tabela nasce fechada; a migration `0009` só
  precisa do `GRANT SELECT TO app_runtime` + trigger `set_updated_at` (padrão `0001`/`0005`).
- **Rationale**: uma linha por CA, imutável na identidade, upsert `ON CONFLICT (ca)` — uuid
  sintético só adicionaria um índice a mais sem consumidor. KISS.
- **Alternatives considered**: `id uuid` PK + `ca` unique (padrão das tabelas tenant — aqui é
  índice redundante sem FK de entrada); RLS habilitado com policy permissiva de leitura (teatro de
  segurança — o GRANT SELECT-only por papel é a tranca real e testável).
- **REVISÃO (T024, 2026-07-02 — fato descoberto no bootstrap real)**: o banco de produção tem um
  **event trigger `ensure_rls`** (config do projeto Supabase, fora das migrations) que habilita
  RLS em TODA tabela nova de `public`. Com RLS ligado e zero policies, o `app_runtime` lia
  **vazio** em produção (bug pego na validação manual), enquanto o Postgres efêmero dos testes —
  sem o trigger — se comportaria diferente. Decisão revisada: a migration `0009` fixa o estado
  **explicitamente** em todos os ambientes — RLS **habilitado** + uma única policy
  `caepi_certificates_global_read` (`FOR SELECT TO app_runtime USING (true)`), declarada no schema
  Drizzle (`pgPolicy` + `enableRLS`). Não é RLS de tenant nem teatro: é a configuração mínima para
  coexistir com a postura RLS-by-default do projeto; a escrita segue **dupla-trancada** (sem GRANT
  de escrita E sem policy de escrita).

## R11 · Fallback semi-manual e testabilidade da coleta

- **Decision**: `scripts/caepi-sync.ts` aceita **`--file <caminho.csv.gz>`**: quando presente,
  **pula `collect.ts`** e ingere o arquivo dado (mesmo `parse` + `upsertMany`). Esse é, ao mesmo
  tempo: o fallback semi-manual oficial (FR-040), o modo de bootstrap offline e o modo usado nos
  testes de integração/CI (fixture `_fixtures/caepi-sample.csv.gz`, amostra real reduzida e
  anonimizável). `collect.ts` não tem teste unitário (browser/rede) — é validado por execução real
  no bootstrap/spike (R2).
- **Rationale**: um único flag entrega três necessidades (fallback, bootstrap, CI) sem caminho de
  código novo — a spec exige exatamente "mesmo parse+upsertMany, zero retrabalho".
- **Alternatives considered**: script separado de import manual (duplicaria orquestração); mock de
  rede do Playwright em CI (frágil e desnecessário — o contrato coleta→ingestão é o arquivo).

## R12 · Observabilidade mínima do job (fail-safe "falha alto")

- **Decision**: o script loga JSON estruturado no padrão do repo (`operation: "caepi.sync"`,
  `phase: start|collect|parse|upsert|finish`, contadores `parsed`/`discarded`/`upserted`,
  `durationMs`) e termina com **exit code ≠ 0** em qualquer falha (coleta, gzip inválido, zero
  linhas válidas) — é o que o agendador (Actions/cron) transforma em alerta. Nenhum sistema de
  alerta novo (YAGNI).
- **Rationale**: "falha alto" (FR-036/US2-7) com o mínimo: exit code + log estruturado são
  suficientes para qualquer agendador notificar; "zero linhas válidas" vira falha para não mascarar
  um layout novo da fonte como carga vazia bem-sucedida.
- **Alternatives considered**: Sentry/notificação dedicada (nova infra — exigiria emenda, sem
  necessidade atual); seguir silencioso em zero linhas (mascararia mudança de layout do CSV).
