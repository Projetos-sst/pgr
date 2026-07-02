/speckit-specify

GIT_BRANCH_NAME: feature/external-integrations-layer

NOTA DE BRANCH: esta é uma **spec NOVA** (`.specs/NNN-caepi-ca-validation/`), mas o trabalho
continua na **MESMA branch** `feature/external-integrations-layer` — NÃO criar branch nova. Todas as
mudanças (CEP/CNPJ já commitadas + CAEPI) convivem nessa branch.

Feature: Validação/consulta de CA no CAEPI/MTE. Forma uma base local espelho da base pública do
MTE (tabela GLOBAL `caepi_certificates`, sem tenant), alimentada por um job de ingestão periódico
(coleta via browser → parse do CSV → upsert idempotente), e expõe uma consulta local de CA
(`lookupCa`) que, no cadastro de EPI, valida se o CA existe/está vigente e autopreenche fabricante,
norma e validade. A consulta é LOCAL e rápida (não faz fetch externo por request); o único acesso
externo é o job. CA vencido/inexistente gera aviso, NUNCA bloqueia o cadastro. Cobre as issues #115
(Validação de CA) e #75 (Consulta de CA — fechar como duplicada).

ANEXO OBRIGATÓRIO (fonte da verdade — leia INTEIRO antes de escrever a spec):

- docs/briefings/caepi-cron-brainstorming.md
  Brainstorming com o RESULTADO DO SPIKE 0 (investigação real da fonte, 02/07/2026). É a fonte
  MAIS ATUAL e PREVALECE sobre o briefing 115 onde houver divergência. Contém: como a fonte
  realmente funciona (Cloudflare + postback ASP.NET + `.csv.gz`), o layout REAL do CSV (`;`, aspas,
  UTF-8 BOM, 19 colunas), a arquitetura revisada (collect/parse/repository/script), e as decisões
  D1–D8 com recomendação KISS.
- docs/briefings/115-caepi-validacao-ca.md
  Briefing técnico da fatia (camadas, tabela, `lookupCa`, hook, UI, edge cases, testes, critérios de
  aceite). ATENÇÃO — duas premissas dele foram CORRIGIDAS pelo Spike 0 e NÃO devem ser reintroduzidas:
  (a) a fonte NÃO é um "TXT delimitado por `|`" — é CSV `;` com aspas e UTF-8 BOM; (b) NÃO é baixável
  por `fetch`/`curl` simples nem por Route Handler serverless com `CRON_SECRET` — exige BROWSER real
  (Cloudflare) + postback ASP.NET, rodado por um SCRIPT AGENDADO (sem endpoint HTTP).
- docs/briefings/caepi-logica-de-negocio.md
  Guia de negócio (as "duas histórias de dados", o papel do CA como atributo validado). Contexto de
  domínio — não é contrato técnico, mas fixa o "porquê".

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (inspirado no ePGR). Antes de
escrever a spec, leia os padrões já vigentes no repo e LISTE os arquivos que vai ler. No mínimo:

- src/shared/integrations/\*\* — a CAMADA DE INTEGRAÇÕES já entregue (CEP/ViaCEP + CNPJ/BrasilAPI) na
  branch feature/external-integrations-layer. É o PADRÃO A COPIAR para tudo que for integração
  externa: `providers/http.ts` (fetch com timeout + USER_AGENT), `providers/types.ts`
  (`ProviderResult<T>` fechado), `cache.ts`, e os hooks client (`client/use-lookup.ts` +
  `use-cep-lookup`/`use-cnpj-lookup`). CAEPI é uma integração — REUSAR esses padrões (DRY).
- src/app/api/integrations/\*\* — o SURFACE de integrações (session-guarded via `requireAuth()`, SEM
  tenant, dado público). `cep/[cep]/route.ts` e `cnpj/[cnpj]/route.ts` + `_lib/respond.ts` são o
  molde do endpoint REST de CAEPI. NÃO há dev-bypass; NÃO há tenant.
- src/shared/db/schema/epis.ts — modelo de EPI (fatia 008). O `epi_catalog` (campos `ca`,
  `ca_valid_until`, `manufacturer`, `norm`) é o CONSUMIDOR do autofill. NÃO alterar o modelo de EPI
  nesta fatia.
- src/shared/db/schema/companies.ts — template canônico de tabela com `org_id` + RLS `app_runtime`.
  ⚠️ `caepi_certificates` é a EXCEÇÃO a esse template (ver DECISÃO DE MODELO): NÃO copiar o `org_id`
  nem a policy de tenant; copiar apenas o padrão de migration (GRANT, trigger `set_updated_at`).
- src/shared/db/with-org.ts — o motor de tenant. Explicitar na spec que a consulta de CAEPI NÃO usa
  `withOrg` (tabela global), e por quê.
- src/shared/server/result.ts, office-action.ts, action-error.ts; src/shared/api/rest.ts — contrato
  `ActionResult<T>`, wrapper de Server Action, mapeamento de erro→HTTP (já inclui `UPSTREAM_ERROR`
  → 502).
- docs/api/api-design.md (seção "Integrações externas") e docs/api/sst-manager.postman_collection.json
  — onde registrar o endpoint de CAEPI (mesmo padrão de CEP/CNPJ).
- docs/produto/04-integracoes-e-servicos.md — padrão de jobs/serviços.

═══════════════════════════════════════════════════════════════════════════════════════
REGRAS/CONTRATOS VIGENTES — NÃO reabrir
═══════════════════════════════════════════════════════════════════════════════════════

1. EXCEÇÃO JUSTIFICADA AO ISOLAMENTO MULTI-TENANT (Princípio I). `caepi_certificates` é DADO PÚBLICO
   do MTE, igual para todos os tenants → é a ÚNICA tabela do módulo SEM `org_id`, SEM policy de RLS
   de tenant e SEM `withOrg`. Justificativa: não há dado de cliente trafegando nem cruzamento de
   tenants a proteger. A spec DEVE documentar essa exceção explicitamente. Consequência de segurança:
   o papel `app_runtime` recebe **apenas SELECT** nessa tabela; a ESCRITA (upsert do job) acontece
   por conexão privilegiada (owner/unpooled), nunca pela app runtime.

2. CONSULTA É LOCAL, NÃO PROXY AO VIVO. `lookupCa` lê `caepi_certificates` (query local em ms). NÃO
   faz fetch externo por request — isso é decisão travada e provada (o proxy ao vivo do ePGR está
   403-quebrado; ver caepi-logica-de-negocio.md). O ÚNICO acesso externo é o job de ingestão, fora do
   caminho do usuário.

3. FALHA NA FONTE NÃO BLOQUEIA O USUÁRIO. Se o job falhar (Cloudflare/timeout), a base anterior
   continua servindo (fail-safe, idempotente). Base vazia/nunca-sincronizada → `lookupCa` responde
   `not_found` com aviso "base CAEPI ainda não sincronizada", NUNCA erro fatal. O salvamento do EPI
   NÃO depende da consulta (CA é auxiliar; campo sempre editável).

4. CAMADA DE INTEGRAÇÕES É O PADRÃO. Reusar `ProviderResult<T>`, o padrão de hook (`use-lookup`),
   `ActionResult<T>`/`officeAction`, e o surface `/api/integrations/**` (session-guarded, sem tenant).
   Erros como CÓDIGOS de domínio, não HTTP cru: formato inválido → `VALIDATION` (422); indisponível →
   `UPSTREAM_ERROR` (502, já existe). NÃO reimplementar contrato.

5. IA É ACELERADOR, NÃO APROVADOR. Casos críticos (isolamento/segurança da tabela global, parsing do
   CSV real) validados à mão. Testes gerados por IA exigem validação rigorosa (CLAUDE.md / constituição).

═══════════════════════════════════════════════════════════════════════════════════════
DECISÃO DE MODELO desta fatia (o "o quê"; detalhe técnico nos anexos)
═══════════════════════════════════════════════════════════════════════════════════════

FONTE REAL (Spike 0 — tratar como fato):

- `caepi.mte.gov.br` → 301 → `caepi.trabalho.gov.br`, atrás de **Cloudflare com desafio JS** →
  cliente não-browser recebe 403. Só BROWSER REAL passa.
- Download = **postback ASP.NET** em `internet/ConsultaCAInternet.aspx`
  (`__doPostBack('ctl00$PlaceHolderConteudo$LinkButton1','')`, exige `__VIEWSTATE`/`__EVENTVALIDATION`).
- Resposta = `application/gzip` → `RelatorioCA_AAAAMMDD_HHMMSS.csv.gz`.
- Descompactado = **CSV**: separador `;`, campos entre aspas `"` (escape `""`, com `;` e quebras de
  linha DENTRO das aspas), **UTF-8 com BOM**, **19 colunas** (cabeçalho em caepi-cron-brainstorming.md §3).

ARQUITETURA (2 responsabilidades decopladas pelo arquivo `.csv.gz`):

- `collect.ts` — ÚNICO passo com browser (Playwright/Chromium): passa Cloudflare, faz o postback,
  captura o `.csv.gz`. Isola toda a fragilidade (anti-corruption layer).
- `parse.ts` — FUNÇÃO PURA (sem I/O): gunzip + parser CSV MADURO (respeita aspas/escape/encoding;
  NÃO parsear na mão) → linhas tipadas (Zod), descarta linha corrompida com log.
- `caepi-repository.ts` — `getByCa(ca)` (consulta) + `upsertMany(rows)` (job), `onConflictDoUpdate`
  por `ca` (idempotente).
- `scripts/caepi-sync.ts` — orquestra collect→parse→upsertMany. É o JOB AGENDADO (semanal/quinzenal).
  O BOOTSTRAP é o MESMO script rodado à mão (DRY). NÃO há Route Handler `/api/cron` nem `CRON_SECRET`.
- Consulta: `normalize.ts` (só dígitos) → `validate-ca.ts` (puro: `valid` se `valid_until >= hoje`,
  senão `expired`) → `lookupCa` (Server Action) → hook `use-caepi-validation` → `ca-field.tsx`.

DECISÕES TRAVADAS (KISS/DRY/YAGNI):

- Escrita = **upsert idempotente** (não truncate-reload, não diff).
- Leitura do arquivo = **streaming** (gunzip + CSV em stream; base é grande).
- Cadência = **1× por semana ou a cada 15 dias** (a base do MTE atualiza devagar; menos requisições =
  menor exposição a flag de bot — porém não muda a dificuldade do desafio por request).
- CA cancelado/vencido = **coluna `situation`**, SEM delete (é estado). Válido/vencido derivado na
  consulta.
- Guardar só as colunas que a consulta usa (mapa em caepi-cron-brainstorming.md §5/D8); demais colunas
  do CSV ignoradas (YAGNI).

TABELA `caepi_certificates` (global): `ca` (unique/índice), `valid_until` (date), `situation` (text),
`manufacturer_name`, `manufacturer_cnpj`, `equipment_name`, `description`, `nature`, `norms`,
`synced_at`. 1 migração nova (drizzle-kit), com GRANT SELECT a `app_runtime` (sem INSERT/UPDATE/DELETE
para runtime) e trigger `set_updated_at` (padrão das migrations 0001/0005).

CaLookupResult (contrato de saída de `lookupCa`): 3 estados — `valid` | `expired` (ambos com `ca`,
`manufacturer`, `norm`, `validUntil`, `equipmentName?`) | `not_found` (só `ca`).

═══════════════════════════════════════════════════════════════════════════════════════
EDGE CASES que a spec MUST cobrir como regra verificável
═══════════════════════════════════════════════════════════════════════════════════════

Consulta:

- CA não existe na base → `not_found` (aviso inline; cadastro segue manual).
- CA vencido (`valid_until < hoje` ou situação vencida/cancelada) → `expired`: aviso "CA vencido"
  DISTINTO de inexistente; AINDA autopreenche os dados.
- CA válido e vigente → `valid`: autopreenche `manufacturer`, `norm`, `ca_valid_until` + badge verde.
- Base vazia/nunca sincronizada → tratar como `not_found` + aviso "base não sincronizada" (NÃO erro).
- Formato de CA inválido (não-dígito/vazio) → `VALIDATION` (422) SEM consultar; hook não dispara.
- Limite de data: `valid_until == hoje` → `valid` (não vencido).
- Digitação rápida (vários blur) → aborta request anterior (AbortController), como em use-lookup.

Ingestão / parse (contra AMOSTRA REAL do CSV):

- Campo entre aspas contendo `;` e/ou quebra de linha → parseado como UM campo (parser CSV correto).
- BOM UTF-8 no início do arquivo → removido; acentos decodificados corretamente (UTF-8).
- Linha corrompida/colunas faltando → descartada com log, NÃO aborta a carga inteira.
- `DATA DE VALIDADE` em `dd/mm/aaaa` → convertida para `date`; data inválida → linha descartada.
- Rodar o job 2× seguidas → base idêntica, SEM duplicar (idempotência do upsert por `ca`).
- Download falhou / gzip truncado → base anterior PRESERVADA; job loga e sai (fail-safe).
- Coleta headless bloqueada pelo Cloudflare → job falha alto (alerta), base preservada; fallback
  semi-manual disponível (ver Decisões em aberto).

Segurança da tabela global:

- `app_runtime` consegue SELECT em `caepi_certificates`, mas NÃO consegue INSERT/UPDATE/DELETE.
- A ausência de `org_id`/RLS de tenant é INTENCIONAL e documentada; nenhuma outra tabela do módulo
  perde isolamento por causa disso.

═══════════════════════════════════════════════════════════════════════════════════════
ESCOPO
═══════════════════════════════════════════════════════════════════════════════════════
DENTRO:

- Schema Drizzle `caepi_certificates` (global) + migração (GRANT SELECT a `app_runtime`, trigger
  updated_at). Exceção de tenant documentada.
- Ingestão: `collect.ts` (browser), `parse.ts` (puro, CSV maduro), `caepi-repository.ts`
  (`getByCa` + `upsertMany` idempotente), `scripts/caepi-sync.ts` (job = bootstrap, DRY).
- Consulta: `normalize.ts`, `validate-ca.ts` (puro), `lookupCa` (Server Action com `officeAction`),
  endpoint REST `GET /api/integrations/caepi/[ca]` (molde CEP/CNPJ), + registro em api-design.md +
  Postman (mesma coleção).
- UI mínima: hook `use-caepi-validation` + `ca-field.tsx` (campo CA + feedback valid/expired/
  not_found) para plugar no formulário de EPI. (A UI COMPLETA do catálogo de EPI é da #18, não desta.)
- Testes: unit (`parse` com amostra real incl. aspas/BOM/linha corrompida; `validate-ca` limite=hoje;
  `normalize`; mapeamento→CaLookupResult nos 3 estados) + integração (Postgres efêmero `INTEGRATION_*`,
  NUNCA SQLite): `upsertMany` idempotente, falha de coleta → base preservada, `getByCa` nos 3 estados,
  guarda de sessão. `npm run check` verde (format+lint+types+unit) + `npm run test:integration`.

FORA (YAGNI / fatias futuras — registrar como Out of Scope):

- UI completa do cadastro de EPI (#18) — aqui só o campo CA + hook.
- Histórico de versões de um CA; notificação proativa de vencimento.
- Fallback para API de terceiros (registrar como alternativa; NÃO implementar).
- Alteração do modelo de EPI (`epis.ts`) — intacto nesta fatia.
- Infra de agendamento em si (definir ONDE o job roda é decisão de infra do time — ver abaixo).

═══════════════════════════════════════════════════════════════════════════════════════
Decisões em aberto a resolver via Clarifications
═══════════════════════════════════════════════════════════════════════════════════════

1. GATE da consulta: `requireOfficeStaff()` (quem cadastra EPI é staff — recomendação do briefing 115)
   vs `requireAuth()` (padrão atual da camada `/api/integrations`, dado público). Escolher um e ser
   consistente entre Server Action e REST.
2. ONDE o job agendado roda: GitHub Actions cron (recomendado — roda Playwright fácil) vs container/VM.
   Decisão de infra; a fatia entrega o SCRIPT independente do agendador.
3. RISCO HEADLESS (Spike restante): confirmar se Chromium headless em IP de datacenter passa o
   Cloudflare. Se NÃO passar de forma estável → o caminho oficial é a INGESTÃO SEMI-MANUAL (baixar o
   `.csv.gz` periodicamente e rodar `parse`+`upsertMany`); a spec deve deixar esse fallback explícito
   e sem retrabalho (mesmo `parse`/`upsertMany`).
4. Conjunto final de colunas da tabela (o mapa D8 está fechado salvo ajuste).
5. `#75` (Consulta de CA) — confirmar fechamento como duplicada de `#115`.

DEFINIÇÃO DE PRONTO: a fatia NÃO conclui sem os testes acima verdes (incluindo idempotência do job,
base preservada em falha e os 3 estados de consulta em Postgres efêmero) + lint + tipos + Prettier.
A exceção de tenant da tabela global e o GRANT SELECT-only para `app_runtime` são validados à mão.
