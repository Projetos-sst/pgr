# Tasks: Validação/consulta de CA no CAEPI/MTE (base local + `lookupCa`)

**Input**: Design documents from `.specs/011-caepi-ca-validation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS — a spec (Definição de pronto) e a constituição exigem unit + integração
(Postgres efêmero `INTEGRATION_*`, **nunca** SQLite nem o banco de dev). Casos críticos (exceção
de tenant, GRANT SELECT-only, parsing do CSV real) são **validados à mão** além dos testes.

**Organization**: Tarefas agrupadas por user story (spec.md). O endpoint REST nasce na US1 (é o
transporte do hook — research R7); a US4 cobre a superfície de integração/documentação
(api-design + Postman).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: US1..US4 (mapeia para as user stories da spec)

## Path Conventions

Projeto único Next.js App Router (plan.md): código em `src/`, script de job em `scripts/`, testes
em `src/__tests__/{unit,integration}`, migrations em `src/shared/db/migrations/`.

---

## Phase 1: Setup

**Purpose**: dependências novas do job e fixture real de CSV (base de todos os testes de parse)

- [ ] T001 Instalar devDependencies do job: `npm i -D playwright csv-parse` e registrar no
      `package.json`; rodar `npx playwright install chromium` localmente; conferir que nada do
      runtime da app importa as libs novas (só `collect.ts`/`parse.ts`/script)
- [ ] T002 [P] Criar a fixture real reduzida `src/__tests__/integration/_fixtures/caepi-sample.csv.gz`
      (gzip de amostra REAL do CSV do MTE) contendo obrigatoriamente: linha válida vigente; linha
      válida vencida (`SITUACAO` VENCIDO e/ou `DATA DE VALIDADE` passada); campo entre aspas com
      `;` interno; campo com quebra de linha interna; acentuação UTF-8; BOM no início; 1 linha
      corrompida (colunas faltando); 1 linha com `DATA DE VALIDADE` inválida. Adicionar também a
      variante truncada `caepi-sample-truncated.csv.gz` (gzip cortado) p/ o teste de fail-safe.
      **Validar o conteúdo à mão contra o layout do Spike 0 (19 colunas)**

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tabela global + migration com GRANT SELECT-only, tipos e normalização — pré-requisito
de TODAS as stories

**⚠️ CRITICAL**: nenhuma story começa antes desta fase completa

- [ ] T003 Criar o schema da tabela GLOBAL em `src/shared/db/schema/caepi-certificates.ts`
      (data-model §1: `ca text` PK, `valid_until date NOT NULL`, `situation text NOT NULL`,
      `manufacturer_name/manufacturer_cnpj/equipment_name/description/nature/norms text` anuláveis,
      `synced_at timestamptz NOT NULL`, `created_at/updated_at`) — **SEM `org_id`, SEM `pgPolicy`/
      `enableRLS`, SEM `withOrg`**, com comentário no arquivo documentando a exceção ao Princípio I;
      exportar em `src/shared/db/schema/index.ts`
- [ ] T004 Gerar a migration `npm run db:generate` → `src/shared/db/migrations/0009_*.sql` e
      acrescentar o SQL custom (padrão 0001/0005): `GRANT SELECT ON public.caepi_certificates TO
  app_runtime;` (**somente SELECT — sem INSERT/UPDATE/DELETE**) + trigger
      `set_updated_at_caepi_certificates`; aplicar com `npm run db:migrate` (a verificação manual
      canônica do GRANT é a T026 — não duplicar aqui)
- [ ] T005 [P] Criar `src/shared/integrations/caepi/types.ts` com `CaepiParsedRow` e
      `CaLookupResult` (união fechada de 3 estados + `baseUnsynced?` — data-model §3)
- [ ] T006 [P] Criar `src/shared/integrations/caepi/normalize.ts` (`normalizeCa` reusando
      `onlyDigits` de `src/shared/integrations/validation.ts`; `isValidCa` = 1–10 dígitos, sem
      letras — research R9)
- [ ] T007 [P] Unit test `src/__tests__/unit/integrations/caepi/normalize.test.ts` (máscara/
      espaços → dígitos; vazio/não-dígito/estouro de tamanho → inválido)

**Checkpoint**: tabela migrada + tipos/normalização prontos — stories podem começar

---

## Phase 3: User Story 1 — Validar CA e autopreencher o cadastro de EPI (Priority: P1) 🎯 MVP

**Goal**: consulta 100% local com 3 estados (`valid`/`expired`/`not_found`), autofill de
fabricante/norma/validade, sem nunca bloquear o cadastro. Inclui o endpoint REST (transporte do
hook) e o campo plugável.

**Independent Test**: semear a base (INSERT direto via conexão admin) com CA vigente, vencido e
nenhum registro para um terceiro número; consultar cada um (Server Action e REST) e verificar os 3
estados, o limite `valid_until == hoje` → `valid`, base vazia → `not_found` + `baseUnsynced`, e
formato inválido → `VALIDATION` sem tocar a base. **Não depende da US2** (job).

- [ ] T008 [P] [US1] Criar `src/shared/integrations/caepi/validate-ca.ts` — função pura
      `validateCa(record, today)` (research R6: `valid` ⇔ situação normalizada NFD/uppercase =
      `VALIDO` **e** `valid_until >= today` inclusivo; senão `expired`; situação desconhecida →
      `expired`) + helper `todayInSaoPaulo()` (`Intl.DateTimeFormat("en-CA", { timeZone:
  "America/Sao_Paulo" })`)
- [ ] T009 [P] [US1] Unit test `src/__tests__/unit/integrations/caepi/validate-ca.test.ts`
      (vigente; vencido por data; **limite `== hoje` → valid**; `VENCIDO`/`CANCELADO`/situação
      desconhecida → expired; normalização de acento/caixa da situação)
- [ ] T010 [US1] Criar `src/shared/db/repositories/caepi.ts` — `getByCa(ca): GetByCaResult`
      (SELECT por PK via singleton `db`, **sem `withOrg`** com comentário da exceção; quando não
      encontra, devolve `baseEmpty` via `SELECT EXISTS` — contracts/repositories.md)
- [ ] T011 [US1] Criar `src/shared/integrations/caepi/lookup.ts` — `lookupCaRecord(ca)`:
      `getByCa` → `validateCa` → mapeia para `CaLookupResult` (coalesce `manufacturer_name/norms`
      → `""`, `equipment_name` → `undefined`, `baseUnsynced` só em `not_found` com base vazia —
      data-model §3)
- [ ] T012 [P] [US1] Unit test `src/__tests__/unit/integrations/caepi/lookup.test.ts` — mapeamento
      → `CaLookupResult` nos 3 estados + `baseUnsynced` (repositório mockado)
- [ ] T013 [US1] Criar a Server Action `src/shared/server/actions/epi/lookup-ca.ts` — `"use
  server"`; guarda inline `requireAuth()` (research R8 — **não** `officeAction`); formato
      inválido → `fail("VALIDATION")` sem tocar a base; erros conhecidos via `toActionError`;
      inesperados relançados (contracts/lookup-surfaces.md)
- [ ] T014 [US1] Criar o Route Handler `src/app/api/integrations/caepi/[ca]/route.ts` (molde
      `cep/[cep]`): `ensureSession()` + `invalidFormat()` de `_lib/respond.ts`; **3 estados como
      payload 200** `ok(CaLookupResult)` (não usar `respondWithProviderResult`); `Cache-Control:
  no-store` (resposta depende de "hoje"); 422/401 conforme contrato
- [ ] T015 [US1] Criar o hook `src/shared/integrations/caepi/client/use-caepi-validation.ts` —
      wrapper do `useLookup` (`isValid: isValidCa`, `buildUrl` → `/api/integrations/caepi/[ca]`
      normalizado); deriva `idle|loading|valid|expired|not_found|error` do payload; `onFound`
      chamado em `valid` **e** `expired`, nunca em `not_found`; herda AbortController/nunca-lançar.
      Incluir unit test `src/__tests__/unit/integrations/caepi/use-caepi-validation.test.tsx`
      (fetch mockado): derivação dos estados do payload; erro/timeout → `error` silencioso;
      dois `lookup` em sequência → o primeiro é abortado (edge cases US1-7/US1-8 — o `useLookup`
      não tem teste próprio no repo)
- [ ] T016 [US1] Criar o campo `src/shared/integrations/caepi/client/ca-field.tsx` — input CA com
      lookup no blur; badge verde (`valid`), aviso "CA vencido" distinto (`expired`, ainda
      autopreenche), "CA não encontrado" / "base CAEPI ainda não sincronizada" (`not_found`/
      `baseUnsynced`), `error` silencioso; autofill via `onFound` escreve **no formulário**; campos
      sempre editáveis (FR-060..063)
- [ ] T017 [US1] Integração (Postgres efêmero) — criar
      `src/__tests__/integration/integrations/caepi.test.ts` com a suíte da consulta: semear via
      client admin (`_helpers/db.ts#adminClient`; a tabela global fica fora do `truncateAll` — a
      suíte limpa `caepi_certificates` no setup); `getByCa`/`lookupCaRecord` → `valid`/`expired`/
      `not_found`; limite `== hoje`; base vazia → `baseUnsynced`; REST: 200 nos 3 estados, 422
      formato inválido (sem tocar a base), 401 sem sessão; Server Action `lookupCa`: sem sessão →
      `fail("UNAUTHORIZED")` (guarda nas DUAS superfícies — SC-008) e caso positivo: sessão com
      papel `client` consegue consultar (gate é só sessão, edge case da spec)

**Checkpoint**: US1 completa — consulta + autofill demonstráveis com base semeada (MVP)

---

## Phase 4: User Story 2 — Formar e manter a base espelho (job de ingestão) (Priority: P1)

**Goal**: `scripts/caepi-sync.ts` (collect → parse → upsertMany) idempotente e fail-safe; fallback
`--file`; bootstrap = mesmo script.

**Independent Test**: rodar o script com `--file` apontando para a fixture real: base populada com
as colunas D8; rodar 2× → base idêntica sem duplicar; fixture truncada → falha alta (exit ≠ 0) com
base preservada.

- [ ] T018 [US2] **SPIKE (primeira tarefa da implementação — research R2)**: implementar
      `src/shared/integrations/caepi/collect.ts` (Playwright/Chromium real: abre
      `ConsultaCAInternet.aspx`, resolve Cloudflare, dispara o postback
      `__doPostBack('ctl00$PlaceHolderConteudo$LinkButton1','')`, captura o download; pós-condições
      arquivo não-vazio + assinatura gzip `1f 8b 08`; senão lança `CollectError`) e **validar por
      execução real**: local (headed/headless) e num runner de CI. Registrar o resultado do spike
      em `.specs/011-caepi-ca-validation/research.md` (R2); se headless não passar de forma
      estável, o caminho oficial passa a ser o fallback `--file` (sem retrabalho)
- [ ] T019 [P] [US2] Criar `src/shared/integrations/caepi/parse.ts` — `parseCaepiCsv(gzipStream,
  onBatch, opts)` em streaming (`zlib.createGunzip()` → `csv-parse` com `delimiter: ";"`,
      `bom: true`, aspas/escape RFC 4180, `relax_column_count: true` → Zod por linha →
      `CaepiParsedRow`); descarte com log/contador por linha corrompida/colunas faltando/data
      inválida/`ca` inválido; `dd/mm/aaaa` → `YYYY-MM-DD`; `batchSize` default 1.000
      (contracts/ingestion-pipeline.md)
- [ ] T020 [P] [US2] Unit test `src/__tests__/unit/integrations/caepi/parse.test.ts` contra a
      fixture REAL (T002): campo com `;`/quebra de linha entre aspas = UM campo; BOM removido +
      acentos corretos; linha corrompida e data inválida descartadas com contador (carga não
      aborta); datas convertidas; **validar os asserts à mão contra a amostra** (spec, IA não
      aprova sozinha)
- [ ] T021 [US2] Criar `src/shared/db/repositories/caepi-upsert.ts` — `upsertMany(dbHandle, rows,
  syncedAt)` com handle Drizzle **injetado** (SEM importar `server-only`/singleton `db`);
      chunks de 1.000; `onConflictDoUpdate` por `ca` atualizando todas as colunas de dado +
      `synced_at`; sem delete/truncate (contracts/repositories.md)
- [ ] T022 [US2] Criar `scripts/caepi-sync.ts` — orquestração collect → parse → upsertMany;
      flag `--file <caminho.csv.gz>` pula a coleta (fallback semi-manual/bootstrap/CI); env
      `DATABASE_URL_UNPOOLED` via `dotenv` (`.env.local` → `.env`) e client próprio
      `drizzle(postgres(url))`; validação gzip antes de escrever; `parsed === 0` → falha; logs
      estruturados (`operation: "caepi.sync"`, fases + contadores) e **exit ≠ 0 em qualquer falha**
      (fail-safe: falha de coleta/gzip acontece ANTES de qualquer escrita — research R12)
- [ ] T023 [US2] Integração (Postgres efêmero) — estender
      `src/__tests__/integration/integrations/caepi.test.ts`: ingestão da fixture via
      `parseCaepiCsv`+`upsertMany` (client admin) → linhas válidas gravadas, corrompidas
      descartadas; **idempotência**: 2ª execução → mesma contagem/valores, zero duplicatas; update
      in-place (mudar `situation`/`valid_until` na 2ª carga); **fail-safe**: fixture truncada →
      erro antes de escrever, base semeada intocada
- [ ] T024 [US2] **Bootstrap real** (validação manual): rodar `npx tsx scripts/caepi-sync.ts`
      com coleta real — localmente; em CI somente se o spike T018 tiver aprovado o headless
      (caso contrário, bootstrap local via `--file`) — e registrar no PR: contadores
      (`parsed/discarded/upserted`), duração e 2ª execução idempotente. Rodar uma consulta real de
      CA conhecido (ex.: 31469) nas duas surfaces

**Checkpoint**: US2 completa — base real populada pelo job; consulta da US1 servida por dado real

---

## Phase 5: User Story 3 — Segurança da tabela global (exceção contida) (Priority: P1)

**Goal**: provar que a exceção ao Princípio I é contida: `app_runtime` SELECT-only; escrita só
pela conexão owner; nenhuma outra tabela perde isolamento.

**Independent Test**: com o client `app_runtime` do harness, `SELECT` funciona e
`INSERT`/`UPDATE`/`DELETE` falham (42501); com o client admin, o upsert funciona.

- [ ] T025 [US3] Integração (Postgres efêmero) — estender
      `src/__tests__/integration/integrations/caepi.test.ts` com a suíte de GRANT: via
      `appRuntimeClient()` → `SELECT` ok; `INSERT`/`UPDATE`/`DELETE` em `caepi_certificates`
      negados (SQLSTATE 42501); via `adminClient()` → upsert ok
- [ ] T026 [US3] **Validação manual documentada** (Definição de pronto da spec): conferir à mão no
      banco que `caepi_certificates` não tem `org_id`/policy de RLS (intencional + comentário no
      schema), que o GRANT é SELECT-only, e que as demais tabelas do módulo EPI mantêm
      `org_id`+RLS intactos; registrar a verificação no PR (checklist)

**Checkpoint**: exceção provada e contida — Princípio I preservado no resto do módulo

---

## Phase 6: User Story 4 — Superfície REST documentada (Priority: P2)

**Goal**: endpoint registrado e testável por Postman/cURL, no padrão CEP/CNPJ (o Route Handler em
si nasceu na US1/T014 — aqui entra a superfície de integração/documentação).

**Independent Test**: importar a coleção Postman, chamar `GET {{baseUrl}}/api/integrations/caepi/
{{ca}}` e obter os contratos documentados (200 payload 3 estados / 422 / 401).

- [ ] T027 [P] [US4] Registrar o recurso em `docs/api/api-design.md` — seção "Integrações
      externas" (tabelas Recursos/Sumário): `GET /api/integrations/caepi/[ca]`, gate só-sessão,
      contrato `CaLookupResult` com 3 estados payload 200 (divergência consciente do 404 de
      CEP/CNPJ, com a justificativa), 422/401
- [ ] T028 [P] [US4] Adicionar o folder **CAEPI** à coleção única
      `docs/api/sst-manager.postman_collection.json` (molde dos folders CEP/CNPJ; reusar
      `{{baseUrl}}`; requests: CA válido, vencido, inexistente, formato inválido)

**Checkpoint**: superfície documentada — issue #115 coberta; #75 fechável como duplicada

---

## Phase 7: Polish & Quality Gate

**Purpose**: portões de qualidade da constituição/spec e higiene final

- [ ] T029 Rodar `npm run check` (format:check + lint + typecheck + unit) e corrigir tudo até
      verde; conferir que nenhum arquivo novo viola Prettier/ESLint
- [ ] T030 Rodar `npm run test:integration` contra Postgres efêmero (`INTEGRATION_DATABASE_URL` +
      `INTEGRATION_DATABASE_URL_ADMIN`) até verde — inclui idempotência, fail-safe, 3 estados,
      GRANT e guarda de sessão; **jamais** apontar para o banco de dev
- [ ] T031 Higiene final: nenhum arquivo temporário do job commitado (`.csv.gz` baixado fica fora
      do repo/gitignore — só as fixtures de teste entram); segredos apenas em env; revisar que
      `epis.ts` permaneceu intacto e que o runtime da app não importa `playwright`/`csv-parse`

---

## Dependencies & Execution Order

```text
Phase 1 (Setup)          T001 ─┐            T002 [P] (fixture)
Phase 2 (Foundational)   T003 → T004        T005/T006 [P] → T007 [P]
                                │
        ┌───────────────────────┴────────────────────────┐
Phase 3 (US1, MVP)       T008/T009 [P] → T010 → T011 → T012 [P]
                         T011 → T013 (action) → T014 (REST) → T015 (hook) → T016 (campo)
                         T017 (integração US1; depende de T010–T014 e T004)
Phase 4 (US2)            T018 (SPIKE — pode iniciar logo após T001, em paralelo à US1)
                         T019 [P] ← T002/T005/T006 · T020 [P] ← T019
                         T021 ← T003/T005 · T022 ← T018/T019/T021 · T023 ← T019/T021/T002
                         T024 ← T022 (execução real)
Phase 5 (US3)            T025/T026 ← T004 (podem rodar após Foundational; arquivo de teste é
                         compartilhado com T017/T023 → sequenciar as edições)
Phase 6 (US4)            T027/T028 [P] ← T014
Phase 7 (Polish)         T029–T031 ← tudo acima
```

- **US1 e US2 são independentes entre si** (US1 testa com base semeada; US2 testa com fixture) —
  ambas dependem só da Foundational.
- O **arquivo de integração é único** (`integration/integrations/caepi.test.ts`): T017, T023 e
  T025 editam o mesmo arquivo → executar em sequência (não [P] entre si), cada um adicionando sua
  suíte.
- T018 (spike headless) é a **primeira tarefa de implementação** recomendada (plan/R2) — só
  precisa de T001; rodar em paralelo com a US1 para de-riscar cedo.

## Parallel Execution Examples

- **Setup**: T001 ∥ T002.
- **Foundational**: após T003 → T004; em paralelo T005 ∥ T006 → T007.
- **US1**: T008 ∥ T009 (pura + teste); depois T010 → T011 com T012 em paralelo ao T013.
- **US1 ∥ US2**: um dev/agente segue T008–T017 enquanto outro faz T018–T022 (arquivos disjuntos;
  só o teste de integração é compartilhado — deixar T023 para depois de T017).
- **US4**: T027 ∥ T028 (docs e Postman são arquivos diferentes).

## Implementation Strategy

1. **MVP = Foundational + US1** (T001–T017): consulta local com 3 estados + autofill + campo
   plugável, demonstrável com base semeada — o valor de negócio da #115.
2. **De-risco antecipado**: disparar T018 (spike collect/headless) logo após T001, em paralelo à
   US1 — é o único risco técnico em aberto; o desenho já absorve o pior caso (fallback `--file`).
3. **US2 em seguida** (T019–T024): liga o job e popula a base real (bootstrap = mesmo script).
4. **US3/US4** fecham segurança e documentação; **Polish** trava os quality gates
   (`npm run check` + `test:integration` verdes) exigidos pela Definição de pronto.
