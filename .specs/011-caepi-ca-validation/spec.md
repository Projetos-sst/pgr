# Feature Specification: Validação/consulta de CA no CAEPI/MTE (base local + `lookupCa`)

**Feature Branch**: `feature/external-integrations-layer`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "Validação/consulta de CA no CAEPI/MTE. Forma uma base local espelho
da base pública do MTE (tabela GLOBAL `caepi_certificates`, sem tenant), alimentada por um job de
ingestão periódico (coleta via browser → parse do CSV → upsert idempotente), e expõe uma consulta
local de CA (`lookupCa`) que, no cadastro de EPI, valida se o CA existe/está vigente e autopreenche
fabricante, norma e validade. A consulta é LOCAL e rápida; o único acesso externo é o job. CA
vencido/inexistente gera aviso, NUNCA bloqueia o cadastro. Cobre as issues #115 (Validação de CA) e
#75 (Consulta de CA — fechar como duplicada)."

> **Spec NOVA na MESMA branch `feature/external-integrations-layer`** — convive com a camada de
> CEP/CNPJ já commitada; **não** cria branch nova. Cobre **#115** e **#75** (a #75 é fechada como
> **duplicada** da #115 — confirmado em Clarifications).
>
> **Fonte da verdade técnica = Spike 0 (02/07/2026, `docs/briefings/caepi-cron-brainstorming.md`)**,
> que PREVALECE sobre o briefing `115-caepi-validacao-ca.md` onde houver divergência. Duas premissas
> do briefing 115 foram **derrubadas** e NÃO retornam nesta spec: (a) a fonte **não** é TXT
> delimitado por `|` — é **CSV `;` com aspas, escape `""`, UTF-8 com BOM, 19 colunas**; (b) a fonte
> **não** é baixável por `fetch`/`curl` nem por Route Handler serverless com `CRON_SECRET` — exige
> **browser real** (Cloudflare com desafio JS) + **postback ASP.NET**, executado por um **script
> agendado** (sem endpoint HTTP).
>
> **Exceção justificada ao Princípio I (isolamento multi-tenant) — decisão travada.**
> `caepi_certificates` é **dado público do MTE**, idêntico para todos os tenants: é a **única**
> tabela do módulo **sem `org_id`, sem policy de RLS de tenant e sem `withOrg`**. Não há dado de
> cliente trafegando nem cruzamento de tenants a proteger. Contrapartida de segurança: o papel
> `app_runtime` recebe **apenas SELECT** nessa tabela; a **escrita** (upsert do job) ocorre por
> **conexão privilegiada (owner/unpooled)**, nunca pela app runtime. Nenhuma outra tabela perde
> isolamento por causa desta exceção.
>
> **A consulta é LOCAL, não proxy ao vivo** — decisão travada e provada: o proxy ao vivo do produto
> de referência (ePGR) está 403-quebrado pelo upstream (`caepi-logica-de-negocio.md` §3/§9). O único
> acesso externo é o job de ingestão, fora do caminho do usuário. Falha na fonte **nunca** bloqueia
> o usuário: a base anterior continua servindo; o salvamento do EPI não depende da consulta.

## Clarifications

### Session 2026-07-02

Decisões em aberto do prompt, resolvidas com o usuário nesta sessão:

- Q: Gate de autorização da consulta (`lookupCa` Server Action + REST
  `GET /api/integrations/caepi/[ca]`) — `requireOfficeStaff()` (briefing 115) ou `requireAuth()`
  (padrão da camada `/api/integrations`)? → A: **`requireAuth()` nos dois surfaces** (só sessão, sem
  tenant/papel). CA é dado público do MTE; gate por papel não protege nada. O REST reusa
  `ensureSession()`/`respond.ts` como CEP/CNPJ; a Server Action usa **guarda de sessão** (não o
  `officeAction` de staff — o item "lookupCa com `officeAction`" do prompt é **substituído** por
  esta decisão, mantendo o retorno `ActionResult<T>` e os códigos de erro do contrato).
  Consequência: papel `client` **pode** consultar; sem sessão → `UNAUTHORIZED` (401). (FR-050/051)
- Q: Cadência do job de ingestão (D6 travou "semanal ou quinzenal" — faltava o valor)? → A:
  **Semanal** (1×/semana). Base mais fresca com exposição ainda baixíssima. (FR-039)
- Q: `#75` (Consulta de CA) é fechada como duplicada da `#115`? → A: **Sim** — esta spec cobre as
  duas; o fechamento acontece no fluxo de PR/issues.

Decisões travadas nos anexos (brainstorming D1–D8 + regras do prompt), incorporadas para a spec
nascer sem ambiguidade:

- Q: Como escrever na base? → A: **Upsert idempotente** (`onConflictDoUpdate` por `ca`); sem
  truncate-reload (janela vazia), sem diff (over-engineering). (FR-034)
- Q: Como ler o arquivo (base nacional, grande)? → A: **Streaming** — gunzip + parser CSV em stream,
  linha a linha, sem carregar tudo na memória. (FR-031)
- Q: Onde o job roda? → A: **Script agendado com browser** (fora do serverless); a fatia entrega o
  script **agnóstico ao agendador** — o ONDE (GitHub Actions cron recomendado vs container/VM) é
  decisão de infra do time, fora do escopo. **Não há Route Handler `/api/cron` nem `CRON_SECRET`.**
  (FR-037, Out of Scope)
- Q: Carga inicial (bootstrap)? → A: O **mesmo script** rodado à mão uma vez (DRY). (FR-038)
- Q: CA cancelado/vencido some da base? → A: **Não** — é estado (coluna `situation`), sem delete;
  válido/vencido é **derivado na consulta**. (FR-005/FR-021)
- Q: Quais colunas guardar? → A: **Só as que a consulta usa** (mapa D8); as demais colunas do CSV
  são ignoradas (YAGNI). (FR-022)
- Q: E se o headless não passar o Cloudflare de forma estável? → A: Caminho oficial vira a
  **ingestão semi-manual** — baixar o `.csv.gz` à mão periodicamente e rodar **o mesmo**
  `parse` + `upsertMany` (zero retrabalho; só o `collect` é substituído). (FR-040, Assumptions A2)
- Q: REST devolve `not_found` como 404 (molde CEP/CNPJ)? → A: **Não** — no CAEPI os 3 estados
  (`valid`/`expired`/`not_found`) são **payload** do contrato `CaLookupResult` (200), porque
  "não encontrado" é resultado informativo de negócio, nunca falha (regra "não bloqueia"). Erros
  HTTP ficam para formato inválido (`VALIDATION` 422) e sessão ausente (`UNAUTHORIZED` 401).
  (FR-051/052)

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Validar CA e autopreencher o cadastro de EPI (Priority: P1)

Como profissional de SST cadastrando um EPI, quero digitar o número do CA e ter o sistema
conferindo **localmente** se o CA existe e está vigente — autopreenchendo fabricante, norma e
validade quando encontrado — para cadastrar EPIs com dado oficial do MTE sem digitação manual e sem
depender da disponibilidade do portal do governo no momento do cadastro.

**Why this priority**: É o valor de negócio da fatia (issues #115/#75): validação + autofill no
campo CA. Tudo o mais (base espelho, job) existe para servir este fluxo.

**Independent Test**: Com a base local semeada com um CA vigente, um vencido e nenhum registro para
um terceiro número: consultar cada um e verificar os 3 estados distintos, o autopreenchimento nos
dois primeiros e que o cadastro segue possível em todos os casos.

**Acceptance Scenarios**:

1. **Given** um CA existente na base com validade `>= hoje`, **When** o usuário informa o número e
   dispara a consulta (blur/lupa), **Then** o resultado é `valid`: badge verde e autopreenchimento
   de fabricante, norma e validade no formulário.
2. **Given** um CA existente com validade `< hoje` (ou situação cadastral vencida/cancelada),
   **When** o usuário consulta, **Then** o resultado é `expired`: aviso "CA vencido" **distinto** de
   inexistente e os dados **ainda são autopreenchidos** (o usuário decide se cadastra assim mesmo).
3. **Given** um número de CA que não existe na base, **When** o usuário consulta, **Then** o
   resultado é `not_found`: aviso inline "CA não encontrado" e o cadastro segue manual (campos
   editáveis).
4. **Given** a base vazia/nunca sincronizada, **When** o usuário consulta qualquer CA, **Then** o
   resultado é tratado como `not_found` com aviso "base CAEPI ainda não sincronizada" — **nunca**
   erro fatal.
5. **Given** um valor de CA com formato inválido (vazio/não-dígito), **When** o usuário sai do
   campo, **Then** a consulta **não dispara** no cliente; se chamada direta, é rejeitada com
   `VALIDATION` (422) **sem** consultar a base.
6. **Given** um CA cuja validade é **exatamente hoje**, **When** consultado, **Then** o resultado é
   `valid` (limite inclusivo — não vencido).
7. **Given** digitação rápida com múltiplos blur, **When** uma nova consulta dispara, **Then** a
   requisição anterior é **abortada** (mesmo comportamento do padrão `use-lookup` de CEP/CNPJ).
8. **Given** qualquer resultado da consulta (`valid`/`expired`/`not_found`/erro/timeout), **When**
   o usuário salva o EPI, **Then** o salvamento **não é bloqueado** — a consulta é auxiliar e os
   campos permanecem sempre editáveis.

---

### User Story 2 — Formar e manter a base espelho do CAEPI (job de ingestão) (Priority: P1)

Como operador da plataforma, quero um job que periodicamente colete o arquivo oficial da base CAEPI
do MTE, o transforme em linhas tipadas e atualize a tabela local de forma **idempotente e à prova de
falha**, para que a consulta do usuário seja sempre um acesso local rápido — mesmo quando o portal
do governo estiver instável ou bloqueando.

**Why this priority**: Sem a base espelho não há o que consultar — é o pré-requisito direto da US1.
É P1 junto com ela porque a fatia só entrega valor com as duas.

**Independent Test**: Executar o script de sincronização com um arquivo `.csv.gz` de amostra real:
verificar base populada com as colunas mapeadas; rodar 2× e verificar base idêntica (sem
duplicatas); simular falha de download/gzip truncado e verificar base anterior preservada.

**Acceptance Scenarios**:

1. **Given** o arquivo oficial coletado (`.csv.gz`), **When** o job roda, **Then** as linhas válidas
   são gravadas/atualizadas na tabela global com as colunas do mapa D8 e o marcador de sincronização
   (`synced_at`) atualizado.
2. **Given** um campo entre aspas contendo `;` e/ou quebra de linha, **When** o arquivo é parseado,
   **Then** o campo é lido como **um** valor (parser CSV correto — nunca `split` manual).
3. **Given** o BOM UTF-8 no início do arquivo e acentuação nos campos, **When** parseado, **Then** o
   BOM é removido e os acentos decodificados corretamente (UTF-8).
4. **Given** uma linha corrompida/colunas faltando ou `DATA DE VALIDADE` inválida (não
   `dd/mm/aaaa`), **When** o parse a encontra, **Then** a linha é **descartada com log** e a carga
   **continua** — nunca aborta a carga inteira por uma linha.
5. **Given** o job executado 2× seguidas com o mesmo arquivo, **When** a segunda execução termina,
   **Then** a base está **idêntica** — sem duplicar registros (idempotência do upsert por `ca`).
6. **Given** falha de download ou gzip truncado, **When** o job detecta a falha, **Then** ele **loga
   e sai** sem tocar na base — a base anterior **continua servindo** (fail-safe).
7. **Given** a coleta headless bloqueada pelo Cloudflare, **When** o job falha, **Then** falha
   **alto** (log/alerta perceptível), a base é preservada e o fallback semi-manual permanece
   disponível (mesmo `parse` + `upsertMany` sobre um arquivo baixado à mão).
8. **Given** um CA que ficou vencido/cancelado na fonte, **When** o job roda, **Then** o registro é
   **atualizado in-place** (coluna `situation`/`valid_until`) — **sem delete**; o estado
   válido/vencido é derivado na consulta.

---

### User Story 3 — Segurança da tabela global (exceção de tenant controlada) (Priority: P1)

Como operador da plataforma, quero que a exceção de isolamento da `caepi_certificates` seja
**estritamente contida**: a aplicação em runtime só consegue **ler** a tabela; escrever nela é
privilégio exclusivo do job (conexão privilegiada); e nenhuma outra tabela do módulo perde
isolamento — para que a exceção justificada não vire porta de entrada para corrupção do espelho nem
precedente de vazamento.

**Why this priority**: A exceção ao Princípio I (constituição) só é aceitável se for demonstrável e
contida. É a contrapartida de segurança obrigatória da arquitetura escolhida.

**Independent Test**: Conectado como `app_runtime`, executar SELECT (sucesso) e
INSERT/UPDATE/DELETE (negados) em `caepi_certificates`; conferir que a tabela não tem `org_id` nem
policy de tenant **por decisão documentada**, e que as demais tabelas do módulo mantêm
`org_id` + RLS intactos.

**Acceptance Scenarios**:

1. **Given** o papel `app_runtime`, **When** executa `SELECT` em `caepi_certificates`, **Then** a
   leitura funciona (sem `withOrg`, sem tenant — dado público).
2. **Given** o papel `app_runtime`, **When** tenta `INSERT`/`UPDATE`/`DELETE` em
   `caepi_certificates`, **Then** a operação é **negada** (GRANT SELECT-only).
3. **Given** o job de ingestão, **When** escreve na tabela, **Then** o faz por **conexão
   privilegiada (owner/unpooled)** — nunca pela conexão runtime da app.
4. **Given** as demais tabelas do módulo de EPI (`epi_catalog`, `epi_stock`, etc.), **When**
   inspecionadas, **Then** todas mantêm `org_id` + RLS de tenant — a exceção é **exclusiva** da
   `caepi_certificates` e está documentada (spec + schema).

---

### User Story 4 — Consultar CA via REST (superfície de integração/teste) (Priority: P2)

Como desenvolvedor/integrador, quero consultar um CA via endpoint REST autenticado
(`GET /api/integrations/caepi/[ca]`), no mesmo molde de CEP/CNPJ, para testar a consulta por
Postman/cURL e reusar a mesma lógica da Server Action sem duplicação.

**Why this priority**: A Server Action não é testável por Postman (POST-only, por design do Next);
o REST é a única superfície diretamente exercitável — mas é espelho da mesma lógica, não valor novo
de negócio, por isso P2.

**Acceptance Scenarios**:

1. **Given** sessão autenticada e um CA existente vigente, **When** `GET /api/integrations/caepi/[ca]`,
   **Then** resposta **200** no envelope `ActionResult<T>` com `CaLookupResult` de estado `valid`
   (mesma regra e payload da Server Action — lógica única, sem reimplementação).
2. **Given** CA vencido ou inexistente, **When** consultado via REST, **Then** resposta **200** com
   estado `expired` ou `not_found` no payload (estados são resultado de negócio, não erro HTTP).
3. **Given** formato inválido, **When** consultado, **Then** `VALIDATION` (422) sem tocar a base.
4. **Given** requisição sem sessão, **When** consultada, **Then** `UNAUTHORIZED` (401) — guarda de
   sessão `requireAuth()`, sem tenant/papel, sem dev-bypass (padrão da camada `/api/integrations`).
5. **Given** o endpoint entregue, **When** a documentação é conferida, **Then** ele está registrado
   em `docs/api/api-design.md` (seção "Integrações externas") e na coleção Postman única
   (`docs/api/sst-manager.postman_collection.json`), no mesmo padrão de CEP/CNPJ.

---

### Edge Cases

- **CA inexistente** → `not_found`; aviso inline; cadastro segue manual. (US1-3)
- **CA vencido** (`valid_until < hoje` **ou** situação cadastral vencida/cancelada) → `expired`,
  aviso **distinto** de inexistente, **ainda autopreenche**. (US1-2)
- **Limite de data**: `valid_until == hoje` → `valid` (não vencido). (US1-6)
- **Base vazia/nunca sincronizada** → tratada como `not_found` + aviso "base CAEPI ainda não
  sincronizada"; **nunca** erro fatal. (US1-4)
- **Formato inválido** (vazio/não-dígito) → `VALIDATION` (422) sem consultar; o hook não dispara no
  cliente. (US1-5)
- **Digitação rápida** (vários blur) → aborta a requisição anterior (AbortController, como
  `use-lookup`). (US1-7)
- **Erro/timeout na consulta** → estado de erro **silencioso** no hook; campos seguem editáveis;
  sem exceção não capturada; salvamento independente. (US1-8)
- **Campo entre aspas com `;`/quebra de linha** → parseado como UM campo. (US2-2)
- **BOM UTF-8** → removido; acentos corretos. (US2-3)
- **Linha corrompida / data inválida** → descartada com log; carga não aborta. (US2-4)
- **Job 2× seguidas** → base idêntica, sem duplicar (idempotência por `ca`). (US2-5)
- **Download falho / gzip truncado** → base anterior preservada; job loga e sai. (US2-6)
- **Cloudflare bloqueia o headless** → job falha alto (alerta); base preservada; fallback
  semi-manual com o mesmo `parse`+`upsertMany`. (US2-7)
- **`app_runtime` tenta escrever na tabela global** → negado (GRANT SELECT-only). (US3-2)
- **Consulta REST sem sessão** → 401; com papel `client` → permitida (dado público, gate é só
  sessão). (US4-4, Clarifications)

## Requirements _(mandatory)_

> Convenção: **MUST** = implementado e testado nesta fatia. Identificadores de código em inglês;
> mensagens de UI em pt-BR. Os fatos da fonte (Cloudflare, postback ASP.NET, CSV `;`/aspas/BOM/19
> colunas) vêm do Spike 0 e são tratados como **fato**, não hipótese.

### Functional Requirements — Consulta local de CA (US1)

- **FR-001**: O sistema MUST normalizar o número de CA informado para **apenas dígitos**
  (`normalize`) antes de qualquer validação ou consulta.
- **FR-002**: Entrada vazia ou não-numérica após normalização MUST ser rejeitada com o código
  `VALIDATION` (422) **sem** consultar a base; no cliente, o hook MUST NOT disparar a consulta para
  formato inválido.
- **FR-003**: A consulta (`lookupCa`) MUST ser **100% local** (leitura da tabela
  `caepi_certificates`); MUST NOT haver qualquer chamada externa no caminho da requisição do
  usuário.
- **FR-004**: O resultado MUST seguir o contrato fechado `CaLookupResult` com exatamente 3 estados:
  `valid` | `expired` (ambos com `ca`, `manufacturer`, `norm`, `validUntil`, `equipmentName?`) |
  `not_found` (só `ca`).
- **FR-005**: A regra de vigência MUST ser derivada na consulta (função pura `validate-ca`):
  `valid` quando o registro existe e `valid_until >= hoje` (limite **inclusivo**: `== hoje` é
  `valid`) e a situação cadastral não indica vencido/cancelado; `expired` quando o registro existe
  mas `valid_until < hoje` **ou** a situação cadastral indica vencido/cancelado; `not_found` quando
  não há registro.
- **FR-006**: Base vazia/nunca sincronizada MUST ser respondida como `not_found` acompanhada do
  aviso "base CAEPI ainda não sincronizada" — MUST NOT ser erro fatal.
- **FR-007**: A consulta MUST NOT usar `withOrg` nem exigir tenant: a tabela é global (dado público
  do MTE, igual para todos os tenants) — exceção documentada no schema e nesta spec.

### Functional Requirements — Tabela global `caepi_certificates` (US3)

- **FR-020**: O sistema MUST introduzir a tabela **global** `caepi_certificates` — **sem `org_id`,
  sem policy de RLS de tenant** — como **única** exceção ao template de tabela tenant
  (`companies.ts`), com a justificativa documentada no schema (dado público do MTE; sem dado de
  cliente; sem cruzamento de tenants a proteger).
- **FR-021**: A tabela MUST guardar apenas as colunas que a consulta usa (mapa D8): `ca`
  (unique/índice — chave da consulta), `valid_until` (date), `situation` (text — estado cadastral
  do MTE, **sem delete** de vencido/cancelado), `manufacturer_name`, `manufacturer_cnpj`,
  `equipment_name`, `description`, `nature`, `norms`, `synced_at` (marcador de frescor). As demais
  colunas do CSV (processo, marca, referência, cor, laudo, laboratório) MUST ser ignoradas (YAGNI).
- **FR-022**: A fatia MUST introduzir **1 migração nova** (drizzle-kit) com SQL custom no padrão das
  migrations `0001`/`0005`: **GRANT SELECT (e somente SELECT) a `app_runtime`** e trigger
  `set_updated_at`. `app_runtime` MUST NOT conseguir `INSERT`/`UPDATE`/`DELETE` na tabela.
- **FR-023**: A **escrita** na tabela (upsert do job) MUST ocorrer exclusivamente por **conexão
  privilegiada (owner/unpooled)**, nunca pela conexão runtime da app (pooler/`app_runtime`).
- **FR-024**: O modelo de EPI (`src/shared/db/schema/epis.ts`) MUST permanecer **intacto** — nenhuma
  coluna, constraint ou relacionamento é alterado nesta fatia.

### Functional Requirements — Ingestão (coleta, parse, upsert, job) (US2)

- **FR-030**: A coleta (`collect`) MUST ser o **único** passo com browser real
  (Playwright/Chromium): resolver o desafio Cloudflare em `caepi.trabalho.gov.br`, executar o
  postback ASP.NET do link de download (exige `__VIEWSTATE`/`__EVENTVALIDATION`) e capturar o
  arquivo `.csv.gz`. Toda a fragilidade da fonte MUST ficar isolada nesse passo (anti-corruption
  layer): trocar a origem do arquivo MUST NOT tocar em parse/repositório/consulta.
- **FR-031**: O parse (`parse`) MUST ser **função pura** (sem I/O), processando em **streaming**
  (gunzip + CSV em stream, linha a linha, sem carregar o arquivo inteiro na memória), usando um
  **parser CSV maduro** que respeite separador `;`, aspas `"` com escape `""` (incluindo `;` e
  quebras de linha DENTRO das aspas) e **UTF-8 com BOM** (BOM removido) — MUST NOT parsear CSV "na
  mão" (`split`).
- **FR-032**: Cada linha parseada MUST ser validada por schema (tipagem forte, sem `any`); linha
  corrompida, com colunas faltando ou com `DATA DE VALIDADE` inválida MUST ser **descartada com
  log** sem abortar a carga.
- **FR-033**: `DATA DE VALIDADE` em `dd/mm/aaaa` MUST ser convertida para `date`; `NR Registro CA`
  MUST ser normalizado para dígitos (mesma normalização da consulta).
- **FR-034**: A escrita MUST ser **upsert idempotente** (`upsertMany`, `onConflictDoUpdate` por
  `ca`): executar o job N vezes MUST produzir o mesmo estado de 1 vez, sem duplicatas e **sem
  janela de base vazia** (MUST NOT truncate-reload).
- **FR-035**: CA vencido/cancelado MUST ser mantido na base com `situation`/`valid_until`
  atualizados in-place — MUST NOT haver delete (é estado; a regra válido/vencido é da consulta,
  FR-005).
- **FR-036**: Em falha de coleta (Cloudflare/timeout/gzip truncado/postback quebrado), o job MUST
  **falhar alto** (log/alerta perceptível) e sair **sem tocar na base** — a base anterior MUST
  continuar servindo (fail-safe). A próxima execução tenta de novo sem efeito colateral.
- **FR-037**: A orquestração MUST ser um **script** (`scripts/caepi-sync.ts`: collect → parse →
  upsertMany) executável de forma **agnóstica ao agendador**. MUST NOT existir Route Handler
  `/api/cron/*` nem `CRON_SECRET` para este job (decisão travada pós-Spike: serverless não roda
  Chromium nem comporta a carga no timeout).
- **FR-038**: O **bootstrap** (primeira carga) MUST ser o **mesmo script** rodado manualmente —
  sem lógica nova (DRY).
- **FR-039**: A cadência de referência do job MUST ser **semanal** (1×/semana — Clarifications); a
  configuração do agendamento em si é decisão de infra fora do escopo (Out of Scope).
- **FR-040**: O fallback **semi-manual** MUST funcionar sem retrabalho: dado um `.csv.gz` baixado à
  mão, o mesmo `parse` + `upsertMany` MUST completar a ingestão (só a coleta é substituída).

### Functional Requirements — Surfaces de consulta (Server Action + REST) (US1/US4)

- **FR-050**: O sistema MUST expor a Server Action `lookupCa(ca)` retornando
  `ActionResult<CaLookupResult>`, guardada por **sessão** (`requireAuth()` — Clarifications; sem
  tenant, sem papel, **não** `officeAction`/staff), com erros como códigos do contrato
  (`VALIDATION` 422, `UNAUTHORIZED` 401) — nunca exceção crua para a UI.
- **FR-051**: O sistema MUST expor o endpoint REST `GET /api/integrations/caepi/[ca]` no **molde de
  CEP/CNPJ** (`ensureSession()` + `invalidFormat()` do `_lib/respond.ts`; envelope
  `ActionResult<T>`; sem dev-bypass; sem tenant), **reusando a mesma** normalização, validação,
  repositório e regra de vigência da Server Action — MUST NOT reimplementar a lógica.
- **FR-052**: No REST, os 3 estados (`valid`/`expired`/`not_found`) MUST ser retornados como
  **payload 200** (`ok(CaLookupResult)`) — `not_found` é resultado de negócio, não erro HTTP
  (Clarifications); formato inválido → `VALIDATION` (422); sem sessão → `UNAUTHORIZED` (401).
- **FR-053**: O endpoint MUST ser registrado em `docs/api/api-design.md` (seção "Integrações
  externas", tabelas Recursos/Sumário) e na coleção Postman única
  (`docs/api/sst-manager.postman_collection.json`), no mesmo padrão dos folders de CEP/CNPJ.

### Functional Requirements — UI mínima (hook + campo CA) (US1)

- **FR-060**: O sistema MUST entregar o hook `use-caepi-validation` seguindo o padrão do
  `use-lookup` da camada de integrações: dispara **só** com formato válido; **aborta** a requisição
  anterior (AbortController) em digitação rápida; **nunca lança** — falha vira estado de erro
  silencioso mantendo os campos editáveis. Estados expostos: `idle` | `loading` | `valid` |
  `expired` | `not_found` | `error`.
- **FR-061**: O sistema MUST entregar o componente `ca-field.tsx` (campo CA + feedback) com os 3
  desfechos **visualmente distintos**: `valid` → badge verde + autopreenche fabricante, norma e
  validade; `expired` → aviso "CA vencido" (distinto de inexistente) **ainda autopreenchendo**;
  `not_found` → aviso "CA não encontrado" (com a variante "base CAEPI ainda não sincronizada"
  quando aplicável).
- **FR-062**: O componente MUST ser plugável no formulário de EPI (consumidor: campos `ca`,
  `ca_valid_until`, `manufacturer`, `norm` do `epi_catalog`) **sem** depender da UI completa do
  catálogo (#18) e **sem** alterar o modelo de EPI. O autopreenchimento escreve **no formulário**
  (vira cópia no `epi_catalog` do cliente ao salvar) — MUST NOT gravar nada na base pública.
- **FR-063**: A consulta MUST ser auxiliar: o salvamento do EPI MUST NOT depender do resultado
  (qualquer estado, erro ou timeout); todos os campos autopreenchidos permanecem editáveis.

### Key Entities _(dados desta fatia)_

- **Certificado CAEPI (`caepi_certificates`)**: espelho local de um registro público de CA do MTE.
  Global (sem tenant), somente-leitura para a aplicação, escrito apenas pelo job. Atributos: número
  do CA (chave única), validade, situação cadastral, fabricante (nome/CNPJ), equipamento, descrição,
  natureza, normas, marcador de sincronização. Uma linha por CA — o upsert atualiza in-place.
- **`CaLookupResult`** (contrato de saída da consulta): união fechada de 3 estados —
  `valid`/`expired` (com `ca`, `manufacturer`, `norm`, `validUntil`, `equipmentName?`) e
  `not_found` (só `ca`). Consumido pela Server Action, pelo REST e pelo hook.
- **Arquivo oficial (`RelatorioCA_*.csv.gz`)**: artefato intermediário que decopla coleta de
  ingestão — CSV `;` com aspas/escape, UTF-8 com BOM, 19 colunas, comprimido em gzip. É o contrato
  entre `collect` e `parse` (e o ponto de entrada do fallback semi-manual).

### Invariantes (não podem ser violadas)

- **Inv-1 — Consulta 100% local.** Nenhuma chamada externa no caminho da requisição do usuário; o
  único acesso externo é o job, fora do caminho do usuário. (FR-003)
- **Inv-2 — Exceção de tenant contida.** A ausência de `org_id`/RLS/`withOrg` é exclusiva da
  `caepi_certificates`, documentada, e compensada por `app_runtime` SELECT-only + escrita
  privilegiada só do job. Nenhuma outra tabela perde isolamento. (FR-020/022/023)
- **Inv-3 — Ingestão idempotente e fail-safe.** Rodar N vezes = 1 vez; falha nunca deixa a base
  vazia/corrompida — o último estado bom continua servindo. (FR-034/036)
- **Inv-4 — Validação nunca bloqueia.** Nenhum estado da consulta (nem falha da fonte, nem base
  não sincronizada) impede o cadastro do EPI; campos sempre editáveis. (FR-006/063)
- **Inv-5 — Modelo de EPI intacto.** `epis.ts` não muda; a consulta não grava nada na base pública;
  o autofill vira cópia no `epi_catalog` do cliente apenas ao salvar. (FR-024/062)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **0** chamadas externas no caminho da consulta do usuário — todo lookup de CA resolve
  localmente; o usuário vê o resultado de imediato mesmo com o portal do MTE fora do ar.
- **SC-002**: Os **3 estados** (válido/vencido/inexistente) são distinguíveis em **100%** das
  consultas — incluindo o limite `validade == hoje` → válido — com autopreenchimento de fabricante,
  norma e validade nos estados válido e vencido.
- **SC-003**: **100%** das tentativas de salvar um EPI seguem possíveis independentemente do
  resultado da consulta (CA vencido, inexistente, base não sincronizada, erro/timeout) — **0**
  bloqueios de cadastro causados pela validação de CA.
- **SC-004**: Rodar o job de ingestão 2× seguidas com o mesmo arquivo produz **0** registros
  duplicados e base final idêntica (idempotência comprovada).
- **SC-005**: Em **100%** das falhas simuladas de coleta (download falho, gzip truncado, bloqueio),
  a base anterior permanece íntegra e servindo consultas (0 janelas de base vazia/corrompida).
- **SC-006**: Contra a **amostra real** do CSV oficial, o parse lê corretamente campos com `;` e
  quebras de linha entre aspas, remove o BOM, decodifica acentos e descarta **apenas** as linhas
  corrompidas (a carga nunca aborta por linha inválida).
- **SC-007**: O papel de runtime da aplicação consegue **ler** e **não consegue escrever**
  (INSERT/UPDATE/DELETE negados) na tabela global em **100%** das verificações; as demais tabelas do
  módulo mantêm isolamento por tenant intacto.
- **SC-008**: **100%** das entradas com formato inválido são rejeitadas sem tocar a base; **100%**
  das requisições sem sessão às superfícies de consulta são negadas (401).
- **SC-009**: As suítes `npm run check` (format + lint + types + unit) e `npm run test:integration`
  passam, incluindo idempotência do job, base preservada em falha e os 3 estados de consulta em
  Postgres efêmero.

## Definição de pronto — testes obrigatórios

Conforme `CLAUDE.md` e a constituição (quality gate), a fatia NÃO é concluída sem os testes abaixo
verdes. **Casos críticos validados à mão** (IA é acelerador, não aprovador): a exceção de tenant da
tabela global, o GRANT SELECT-only para `app_runtime` e o parsing do CSV real.

- **Unitários**: `parse` contra **amostra real** do CSV (linha ok; campo entre aspas com `;` e
  quebra de linha; BOM + acentos UTF-8; linha corrompida descartada com log; data inválida
  descartada); `validate-ca` (válido/vencido com limite `== hoje` → válido; situação
  vencida/cancelada → `expired`); `normalize` (máscara/espaços → dígitos); mapeamento registro →
  `CaLookupResult` nos 3 estados.
- **Integração — Postgres efêmero (`INTEGRATION_*`), NUNCA SQLite**: `upsertMany` idempotente
  (2× sem duplicar, update in-place de `situation`/`valid_until`); falha de coleta simulada → base
  preservada; `getByCa`/`lookupCa` nos 3 estados (base semeada) + base vazia → `not_found`;
  guarda de sessão nas superfícies (sem sessão → `UNAUTHORIZED`/401); GRANT: `app_runtime` SELECT
  ok, escrita negada.
- **Coleta (`collect`)**: não testável em unit (browser/rede) → validada por execução real no
  bootstrap; no CI, a saída é mockada (arquivo `.csv.gz` de amostra) para exercitar
  parse + upsert de ponta a ponta.

> Justificativa do Postgres efêmero: GRANTs por papel, `onConflictDoUpdate` e o comportamento da
> tabela global só podem ser provados contra Postgres real; jamais apontar `INTEGRATION_*` para o
> banco de dev.

## Assumptions

- **A1 — Fatos da fonte (Spike 0) valem como fato**: Cloudflare com desafio JS (403 para
  não-browser), postback ASP.NET com `__VIEWSTATE`/`__EVENTVALIDATION`, resposta
  `application/gzip` → `RelatorioCA_*.csv.gz`, CSV `;`/aspas/escape `""`/UTF-8 BOM/19 colunas,
  `DATA DE VALIDADE` em `dd/mm/aaaa`, `SITUACAO` ∈ {VÁLIDO, VENCIDO, …}. Onde o briefing 115
  divergir, o Spike 0 prevalece.
- **A2 — Risco headless residual**: falta confirmar se Chromium headless em IP de datacenter passa
  o Cloudflare de forma estável (spike no início da implementação). Se não passar, o caminho
  oficial vira a **ingestão semi-manual** (FR-040) — mesmo `parse`+`upsertMany`, zero retrabalho.
  O risco de o portal mudar (ASP.NET/Cloudflare/campos) é **aceito sem prevenção**: contenção via
  isolamento em `collect`, falha alta e fail-safe.
- **A3 — Agendador é decisão de infra do time**: a fatia entrega o script agnóstico; recomendação
  registrada = GitHub Actions cron semanal (roda Playwright com facilidade; credenciais de banco
  como secrets), alternativas equivalentes: container/VM com cron.
- **A4 — Colunas fechadas pelo mapa D8** (salvo ajuste pontual do time durante o plan): só as
  colunas que a consulta usa; demais ignoradas.
- **A5 — Gate = sessão (`requireAuth()`)** nos dois surfaces (Clarifications): CA é dado público;
  papel `client` pode consultar; a recomendação de staff do briefing 115 foi substituída.
- **A6 — REST devolve os 3 estados como payload 200** (Clarifications): diverge do molde CEP/CNPJ
  (que usa 404 para not_found) porque no CAEPI "não encontrado" é resultado informativo que a UI
  exibe como aviso — nunca falha.
- **A7 — `expired` considera situação cadastral**: além de `valid_until < hoje`, situação do MTE
  indicando vencido/cancelado também produz `expired` (o CA existe — distinto de `not_found`).
- **A8 — Base grande → streaming** (D2): a base nacional não cabe confortavelmente em memória; o
  gzip chega em chunks sem `content-length`.
- **A9 — `#75` fechada como duplicada da `#115`** (Clarifications): esta spec cobre as duas; o
  fechamento ocorre no fluxo de PR/issues.
- **A10 — Camada de integrações (CEP/CNPJ) já entregue nesta branch**: `ProviderResult<T>`,
  `http.ts`, `use-lookup`, surface `/api/integrations/**` com `ensureSession`/`respond.ts` — CAEPI
  reusa os padrões (DRY), com a diferença estrutural de que o "provider" do CAEPI é a base local,
  não um fetch externo por request.

## Out of Scope

- **UI completa do cadastro/catálogo de EPI** (`#18`) — aqui só o campo CA (`ca-field.tsx`) + hook,
  plugáveis no formulário quando a #18 existir.
- **Histórico de versões de um CA** e **notificação proativa de vencimento** (futuro).
- **Fallback para API de terceiros** (ex.: Infosimples) — registrado como alternativa de último
  caso (Plano B do brainstorming §8), **não implementado**.
- **Alteração do modelo de EPI** (`src/shared/db/schema/epis.ts`) — intacto nesta fatia.
- **Infra de agendamento em si** (onde o cron roda, secrets do runner) — decisão do time; a fatia
  entrega o script agnóstico ao agendador.
- **Route Handler de cron / `CRON_SECRET`** — descartados por decisão travada (não existe endpoint
  HTTP para o job).
- **Edição manual da base pública** e **proxy ao vivo** ao portal do MTE — proibidos por decisão
  travada.
- **Mirror/dataset alternativo** (`dados.gov.br` etc.) — investigado só se o Plano B for acionado.

## Dependencies

- **Camada de integrações externas** (esta branch, commit `ea86029`):
  `src/shared/integrations/**` (`ProviderResult<T>`, `cache.ts`, `providers/http.ts`,
  `client/use-lookup.ts`) e `src/app/api/integrations/**` (`_lib/respond.ts` com
  `ensureSession`/`invalidFormat`/`respondWithProviderResult`, incl. `UPSTREAM_ERROR` → 502) —
  padrão a copiar/reusar.
- **Fatia 008 — modelo de EPIs**: `epi_catalog` com `ca`, `ca_valid_until`, `manufacturer`, `norm`
  (consumidor do autofill; não alterado).
- **Contratos 007**: `ActionResult<T>` (`src/shared/server/result.ts`), `toActionError`
  (`action-error.ts`), mapeamento erro→HTTP (`src/shared/api/rest.ts`).
- **Padrão de migration com SQL custom** (GRANT/trigger `set_updated_at`): migrations
  `0001`/`0005`; template de schema em `src/shared/db/schema/companies.ts` (copiado **sem** o
  `org_id`/policy de tenant — exceção documentada).
- **Motor de tenant** (`src/shared/db/with-org.ts`): referenciado apenas para explicitar que a
  consulta CAEPI **não** o usa (tabela global).
- **Docs**: `docs/api/api-design.md` (seção "Integrações externas") +
  `docs/api/sst-manager.postman_collection.json` (coleção única);
  `docs/produto/04-integracoes-e-servicos.md` (padrão de jobs — com a ressalva de que este job não
  usa `CRON_SECRET`).
- **Fonte externa**: portal CAEPI do MTE (`caepi.trabalho.gov.br`) — dependência sem contrato/SLA;
  risco aceito e contido (A2, FR-030/036).
- **Issues**: `#115` (Validação de CA) e `#75` (Consulta de CA, duplicada); contexto do módulo em
  `docs/briefings/epi-fluxos-panorama.md`.
