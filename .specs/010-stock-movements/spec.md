# Feature Specification: Movimentações de estoque e histórico (`stock_movements`)

**Feature Branch**: `feature/stock-movements`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "Movimentações de estoque e histórico (stock_movements) — UI + Server Actions + REST. Registrar entrada (compra) e saída manual (ajuste/descarte) de itens de estoque de EPI, mantendo o saldo materializado (`epi_stock.balance`) por transação atômica, e exibir o histórico de movimentações por item com saldo resultante derivado. Sobre o modelo da 008 e a contrapartida da 009 (que trata `balance` como somente-leitura). Isolamento multi-tenant, saldo nunca negativo, validação zod."

> **Camada de FLUXO sobre a fundação da 008 — não reabre o modelo de dados.** A fatia 008
> (`src/shared/db/schema/epis.ts`, migrations `0007`/`0008`) criou as tabelas `stock_movements`
> (movimentos tipados: `purchase | employee_delivery | adjustment | discard`, `quantity` sempre
> positivo com `CHECK quantity > 0`) e `epi_stock` (saldo materializado `balance` com
> `CHECK balance >= 0`), ambas com `org_id text NOT NULL → orgs.id`, índices e RLS `app_runtime`.
> A fatia 009 (`src/shared/db/repositories/epi-stock.ts`) entregou o **CRUD do registro de estoque**
> tratando `balance` como **somente-leitura** ("só muda por `#72`"). **Esta fatia É o `#72`**: aqui o
> saldo finalmente é **escrito**, e **apenas por aqui** (mais a entrega `#19`, fora do escopo). A 009
> entrega o "estado"; esta entrega o "fluxo" que produz esse estado.
>
> **Esta fatia herda — e NÃO reabre — o Modelo B de tenant (005) e o isolamento (004).** Tenant = o
> **escritório** (`orgs.id`), nunca a organização do Clerk. Todo acesso é escopado pelo escritório
> ativo, resolvido sempre da sessão (`requireTenantContext()`), NUNCA de input do cliente, com RLS
> `app_runtime` como backstop. **Zero migration nesta fatia** — todos os gaps de modelo são
> resolvidos por derivação/omissão, sem alterar o schema da 008.

## Clarifications

### Session 2026-06-26

Decisões travadas no briefing (`docs/briefings/briefing-stock-movements.md`), incorporadas à spec
para nascer sem ambiguidade:

- Q: Como exibir o "saldo resultante" se não há coluna `balance_after`? → A: **derivado** por soma
  acumulada (window function) na leitura do histórico; **sem coluna nova, sem migration**. (FR-030)
- Q: O histórico deve registrar "usuário que registrou"? → A: **OMITIDO** nesta fatia — o modelo 008
  não tem `created_by`; fica como item futuro (migration própria). (Out of Scope)
- Q: `adjustment` é entrada ou saída? → A: **somente saída (decremento)** nesta fatia; sem ajuste
  bidirecional. (FR-021)
- Q: Qual a rota do histórico? → A: **`/epi-stock/[id]/history`** (padrão `epi-stock` do projeto),
  não `/estoque/historico/:id` do card. (FR-040)
- Q: Como sinalizar saldo insuficiente? → A: novo código de erro **`INSUFFICIENT_STOCK` (→ 422)**.
  (FR-024)
- Q: Inclui REST? → A: **sim**, `/api/v1/epi-stock/[id]/movements` (registrar + histórico). (FR-043)
- Q: `movement_date` é data ou timestamp? → A: é **`date`** (sem hora); ordenar
  `movement_date DESC, created_at DESC`; UI exibe só a data. (FR-031)
- Q: Banco dos testes de integração? → A: **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite nem o
  banco de dev (as suítes fazem `TRUNCATE`). (Definição de pronto)

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Registrar entrada de estoque (compra) (Priority: P1)

Como gestor de SST do escritório, quero registrar a **entrada** de itens de estoque (compra) —
informando data, quantidade e, opcionalmente, o número da nota fiscal — para que o **saldo do item
seja incrementado automaticamente** e o movimento fique registrado de forma auditável.

**Why this priority**: É a porta de entrada do estoque e a primeira escrita de saldo do sistema —
sem ela o `balance` da 009 nunca cresce e nada mais (saída, histórico) faz sentido. É a MVP da fatia.

**Independent Test**: Com um item de estoque existente no escritório ativo, registrar uma entrada de
quantidade N; verificar que o saldo passou a `balance + N`, que um movimento `purchase` foi criado
com a data e a NF informadas, e que o novo saldo é refletido na listagem da 009.

**Acceptance Scenarios**:

1. **Given** um item de estoque do escritório ativo com saldo `B`, **When** o gestor registra uma
   entrada de quantidade `N` (> 0) com data e NF opcional, **Then** um movimento `purchase` é criado
   e o saldo passa a `B + N`, tudo numa única transação.
2. **Given** uma entrada registrada, **When** a operação retorna, **Then** ela devolve o **novo
   saldo** para a UI atualizar sem refetch, e o status derivado do item é recalculado na listagem.
3. **Given** um formulário de entrada, **When** a quantidade é zero, negativa ou ausente, **Then** a
   operação é rejeitada por validação e **nada** é gravado.
4. **Given** um id de estoque inexistente ou de outro escritório, **When** o gestor tenta registrar
   entrada nele, **Then** o resultado é `NOT_FOUND` (404) e nada é gravado.

---

### User Story 2 — Registrar saída manual com saldo nunca negativo (Priority: P1)

Como gestor de SST, quero registrar **saídas manuais** (ajuste ou descarte) de um item — informando
data, quantidade e tipo de saída — com a **garantia de que o saldo nunca fica negativo**, recusando
qualquer saída maior que o disponível sem gravar nada.

**Why this priority**: A saída é a contrapartida da entrada e carrega o **maior risco técnico** da
fatia (saldo negativo / "double spend"). A não-negatividade do saldo é uma invariante de integridade
de dados — tão crítica quanto a própria operação.

**Independent Test**: Com um item de saldo `B`, registrar uma saída `S ≤ B` (tipo `adjustment` ou
`discard`) e verificar saldo `B - S` + movimento criado; depois tentar uma saída `S' > B` e verificar
que é recusada com erro claro e que **nem o saldo nem a contagem de movimentos mudam** (rollback).

**Acceptance Scenarios**:

1. **Given** um item com saldo `B`, **When** o gestor registra uma saída de quantidade `S ≤ B` com
   tipo `adjustment` ou `discard`, **Then** um movimento do tipo escolhido é criado e o saldo passa
   a `B - S`, numa única transação.
2. **Given** um item com saldo `B`, **When** o gestor tenta uma saída `S > B`, **Then** a operação é
   rejeitada com `INSUFFICIENT_STOCK` (422, mensagem "Saldo insuficiente: disponível B, solicitado
   S") e **nada** é gravado (nem movimento, nem alteração de saldo).
3. **Given** o formulário de saída, **When** o tipo informado não é `adjustment` nem `discard` (p.ex.
   `purchase` ou `employee_delivery`), **Then** a operação é rejeitada por validação.
4. **Given** duas saídas concorrentes do mesmo item, **When** ambas tentam decrementar o saldo,
   **Then** elas são serializadas e o saldo final nunca fica negativo (sem "double spend").

---

### User Story 3 — Histórico de movimentações por item com saldo resultante (Priority: P2)

Como gestor de SST, quero consultar o **histórico completo** de movimentações de um item de estoque,
vendo data, tipo, quantidade e o **saldo resultante** de cada movimento em ordem cronológica, para
auditar a evolução do estoque.

**Why this priority**: Entrega a visibilidade/auditoria sobre o fluxo das US1/US2. É valor real, mas
depende da existência dos movimentos (US1/US2) e não bloqueia a operação — por isso P2.

**Independent Test**: Para um item com vários movimentos (entradas e saídas), abrir
`/epi-stock/[id]/history` e verificar a tabela ordenada cronologicamente, com o saldo resultante de
cada linha batendo com o `balance` atual ao final; abrir um item sem movimentos e ver o estado vazio.

**Acceptance Scenarios**:

1. **Given** um item com movimentos variados, **When** o gestor abre o histórico, **Then** vê todos
   os movimentos do item em ordem `movement_date DESC, created_at DESC`, com Data, Tipo (rótulo
   pt-BR), Quantidade, **Saldo Resultante** (derivado) e Nº NF quando preenchido.
2. **Given** um movimento originado de entrega (`employee_delivery`), **When** o histórico é exibido,
   **Then** o **funcionário** correspondente é mostrado (via `delivery_id`); para os demais tipos a
   coluna fica vazia.
3. **Given** um item sem nenhum movimento, **When** o gestor abre o histórico, **Then** um **estado
   vazio** é exibido (não um erro).
4. **Given** um histórico volumoso, **When** o gestor navega, **Then** a lista é **paginada** e a
   navegação nunca cruza escritórios.

---

### User Story 4 — Isolamento entre escritórios (Priority: P1)

Como operador da plataforma, quero que os movimentos e o histórico de um escritório nunca apareçam,
sejam registrados ou consultados por outro escritório — mesmo que uma consulta esqueça o filtro de
tenant — para não vazar dados entre clientes do SaaS.

**Why this priority**: Vazamento entre escritórios é a falha crítica de um SaaS B2B (constituição,
Princípio I). `stock_movements`/`epi_stock` são dados de negócio e exigem o mesmo backstop de
isolamento de toda a cadeia.

**Independent Test**: Com itens/movimentos nos escritórios A e B e A como ativo: registrar/consultar
movimento de um item de B pelo id → `NOT_FOUND`/404; histórico só mostra movimentos de A; sem tenant
fixado no repositório/RLS, uma leitura nunca devolve todos os registros.

**Acceptance Scenarios**:

1. **Given** itens de estoque dos escritórios A e B e A como ativo, **When** o histórico de um item
   de A é carregado, **Then** apenas movimentos de A aparecem; nada de B.
2. **Given** um item pertencente ao escritório B, **When** o gestor de A tenta registrar entrada/saída
   ou consultar o histórico dele pelo id, **Then** o resultado é `NOT_FOUND` (404) e nada de B é lido
   nem alterado.
3. **Given** uma página protegida/Server Action/Route Handler desta fatia, **When** não há
   autenticação/escritório ativo resolvido, **Then** o acesso é bloqueado pelo gate — a ausência de
   tenant **não** é tratada como histórico vazio normal.
4. **Given** o repositório/RLS sem tenant fixado na transação, **When** uma leitura é executada,
   **Then** o comportamento seguro é erro de contexto ou conjunto vazio — **jamais** todos os
   registros nem dados de outro escritório.

---

### Edge Cases

- **Saída maior que o saldo**: recusada com `INSUFFICIENT_STOCK` (422); rollback total — nem
  movimento, nem alteração de saldo.
- **Quantidade zero ou negativa** (entrada ou saída): rejeitada por validação (422); nada gravado.
- **Item de estoque de outro escritório** (por id): registrar/consultar → `NOT_FOUND`/404; nunca
  aparece no histórico.
- **Histórico volumoso**: paginado no servidor; a navegação nunca cruza escritórios.
- **Histórico vazio**: item sem movimentos → estado vazio (não erro).
- **`movement_date` é `date` (sem hora)**: empate intra-dia desempatado por `created_at` na ordenação.
- **Tipo inválido na saída**: saída manual só aceita `adjustment` ou `discard`; `purchase`/
  `employee_delivery` → rejeitado por validação.
- **Concorrência**: duas saídas simultâneas do mesmo item não furam o saldo (serialização por
  `SELECT … FOR UPDATE`); o `CHECK balance >= 0` do banco é backstop caso a validação da app escape.
- **Sem autenticação/escritório ativo** em página/Server Action/REST: bloqueado pelo gate — não é
  tratado como histórico vazio.
- **Papel `client`**: membro vinculado a uma empresa específica tem acesso negado a registrar e a
  consultar movimentos.
- **NF na saída**: número de nota fiscal só faz sentido na entrada (compra); saída não coleta NF.

## Requirements _(mandatory)_

> Convenção: **MUST** = implementado e testado nesta fatia. Identificadores de código em inglês; os
> valores de `type` do domínio são `purchase`/`adjustment`/`discard`/`employee_delivery`, exibidos em
> pt-BR (compra/ajuste/descarte/entrega).

### Functional Requirements — Registrar entrada e saída (US1/US2)

- **FR-001**: O sistema MUST oferecer o registro de **entrada** (`purchase`) de um item de estoque,
  recebendo `stockId`, `quantity` (> 0), `movementDate` e `invoiceNumber` (opcional), criando um
  movimento e **incrementando** `epi_stock.balance`.
- **FR-002**: O sistema MUST oferecer o registro de **saída manual** de um item, recebendo `stockId`,
  `quantity` (> 0), `movementDate` e `type ∈ {adjustment, discard}`, criando um movimento e
  **decrementando** `epi_stock.balance`.
- **FR-003**: `quantity` MUST ser sempre positivo (`> 0`); o **sinal/efeito no saldo é determinado
  pelo `type`** (`purchase` = `+`; `adjustment`/`discard` = `−`), nunca pelo valor.
- **FR-004**: Cada registro MUST ocorrer numa **única transação atômica**: travar a linha do
  `epi_stock` (`SELECT … FOR UPDATE`) → calcular `novoSaldo = balance ± quantity` → validar
  `novoSaldo >= 0` → inserir o movimento → atualizar o saldo. Falha em qualquer passo MUST causar
  **rollback total** — nunca um movimento sem ajuste de saldo, nem saldo sem movimento.
- **FR-005**: A operação de registro MUST devolver o **saldo resultante** (`{movement, newBalance}`)
  para a UI refletir o novo saldo e o status derivado sem refetch.

### Functional Requirements — Integridade do saldo (US2)

- **FR-020**: O saldo MUST **nunca** ficar negativo. Uma saída cuja quantidade exceda o saldo
  disponível MUST ser **recusada** e **nada** MUST ser gravado.
- **FR-021**: `adjustment` MUST ser tratado como **saída (decremento)** nesta fatia; **não** há ajuste
  bidirecional. A saída manual MUST aceitar somente `type ∈ {adjustment, discard}`.
- **FR-022**: A validação de não-negatividade MUST ocorrer **na aplicação** (mensagem amigável) e o
  `CHECK balance >= 0` do Postgres MUST permanecer como **backstop** (defesa em profundidade).
- **FR-023**: Operações concorrentes sobre o mesmo item MUST ser **serializadas** (`SELECT … FOR
UPDATE`) de modo que duas saídas simultâneas não furem o saldo.
- **FR-024**: Saldo insuficiente MUST ser expresso como o **código de erro padronizado**
  `INSUFFICIENT_STOCK` (equivalente a 422), com mensagem clara ("Saldo insuficiente: disponível X,
  solicitado Y") — não como erro de constraint cru.

### Functional Requirements — Histórico (US3)

- **FR-030**: O histórico de um item MUST listar **todos** os movimentos do item no escritório ativo,
  com Data, Tipo (rótulo pt-BR), Quantidade, **Saldo Resultante** e Nº NF (quando preenchido). O
  **saldo resultante é DERIVADO** por soma acumulada em ordem cronológica (compra `+`, demais `−`) —
  **sem coluna `balance_after` e sem migration**.
- **FR-031**: O histórico MUST ser ordenado por `movement_date DESC, created_at DESC` (desempate
  intra-dia, pois `movement_date` é `date`); a UI MUST exibir apenas a data.
- **FR-032**: O histórico MUST exibir o **funcionário** associado quando o movimento veio de entrega
  (`type = employee_delivery`, via `delivery_id → epi_deliveries → employee`); para os demais tipos a
  coluna fica vazia. (Os movimentos `employee_delivery` são gerados por `#19`, fora do escopo.)
- **FR-033**: O histórico MUST ser **paginado no servidor** e tratar **estado vazio** (item sem
  movimentos) sem erro.
- **FR-034**: O saldo resultante acumulado MUST bater com `epi_stock.balance` atual — invariante
  garantida porque o saldo só é escrito por esta camada (009 mantém `balance` read-only).

### Functional Requirements — UI e REST (US1/US2/US3)

- **FR-040**: A UI MUST oferecer um **modal de entrada** (Data, Quantidade, Nº NF opcional) e um
  **modal de saída manual** (Data, Quantidade, Tipo: Ajuste/Descarte) na tela de estoque da 009, e
  uma **tela de histórico** em **`/epi-stock/[id]/history`** (Server Component).
- **FR-041**: A tela de histórico MUST exibir a tabela do FR-030/FR-032 **sem** coluna "Usuário"
  (decisão travada — modelo sem `created_by`).
- **FR-042**: Após registrar entrada/saída, a UI MUST refletir o **novo saldo** e o **novo status
  derivado** na listagem da 009.
- **FR-043**: O sistema MUST expor endpoints REST em **`/api/v1/epi-stock/[id]/movements`** —
  **POST** para registrar (entrada/saída) e **GET** para o histórico paginado — alinhados ao padrão
  `epi-stock` e testáveis no Postman.

### Functional Requirements — Isolamento, autorização e contrato (cross-cutting, US4)

- **FR-050**: Todo acesso a dados (leitura e escrita) MUST ser escopado pelo escritório ativo, cujo
  identificador MUST vir sempre da sessão (`requireTenantContext()`) — NUNCA de input do cliente
  (query, corpo, cabeçalho) nem da org do Clerk.
- **FR-051**: O isolamento MUST ter **backstop no banco** (RLS `app_runtime`, via `withOrg`): registrar
  ou consultar movimento/histórico de um item de outro escritório MUST retornar `NOT_FOUND` (404), e
  o histórico cross-tenant MUST retornar vazio.
- **FR-052**: Toda Server Action e Route Handler MUST validar a entrada por esquema (zod) **antes** de
  aplicar regra de negócio.
- **FR-053**: Toda Server Action MUST retornar o contrato padronizado `ActionResult<T>` (sem vazar
  exceção crua para a UI). Os erros MUST ser **códigos do contrato**: `VALIDATION` (422),
  `NOT_FOUND` (404), `FORBIDDEN` (403), `INSUFFICIENT_STOCK` (422).
- **FR-054**: As **escritas** (entrada e saída) MUST registrar evento de auditoria de fronteira **sem
  PII** (`auditedTenantWrite`/`logTenantEvent`); as **leituras** (histórico) **NÃO** emitem evento.
- **FR-055**: O acesso MUST ser restrito à equipe do escritório (`requireOfficeStaff()` —
  `owner`/`collaborator`); membros com papel `client` MUST NOT registrar nem consultar movimentos.

### Key Entities _(modelo herdado da 008 — fonte da verdade no schema/`data-model.md`)_

- **Movimento de estoque (`stock_movements`)**: registro tipado e auditável de uma alteração de
  estoque dentro do escritório. Campos: `type` (`purchase | employee_delivery | adjustment | discard`),
  `quantity` (inteiro `> 0`), `movementDate` (`date`), `invoiceNumber` (opcional), `stockId` (→
  `epi_stock`, cascade), `delivery_id` (→ `epi_deliveries`, set null, opcional). Pertence ao tenant
  (`org_id`).
- **Registro de estoque (`epi_stock`)**: item de estoque com **saldo materializado** `balance`
  (inteiro, `CHECK >= 0`) e `min_quantity`; único por `(org_id, catalog_id)`. Esta fatia **escreve**
  `balance`; a 009 só lê.
- **Saldo Resultante** (conceito derivado, **sem coluna**): soma acumulada dos efeitos dos movimentos
  em ordem cronológica; calculado na leitura do histórico.

### Invariantes herdadas / introduzidas (não podem ser violadas)

- **Inv-1 — Escopo sempre pelo escritório ativo.** Todo acesso é escopado pelo tenant da sessão,
  nunca por input do cliente. (FR-050)
- **Inv-2 — Backstop de RLS é real.** Cross-tenant por id → `NOT_FOUND`/404; histórico cross-tenant →
  vazio; ausência de tenant em página/action/REST é bloqueada pelo gate; no repositório/RLS sem
  tenant fixado, o comportamento seguro é erro de contexto ou conjunto vazio. (FR-050/FR-051)
- **Inv-3 — Saldo não-negativo e consistente.** `balance` nunca fica negativo; cada movimento tem
  ajuste de saldo correspondente e vice-versa (atomicidade); o acumulado do histórico bate com
  `balance`. (FR-004/FR-020/FR-034)
- **Inv-4 — Saldo só muda por esta camada.** `balance` é escrito apenas por entrada/saída desta fatia
  (mais `#19`, fora do escopo); a 009 mantém `balance` read-only. (FR-034)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: O saldo do item é atualizado **imediatamente** após registrar uma entrada ou saída
  (entrada incrementa, saída decrementa), sobre o modelo da 008 (sem migration nova).
- **SC-002**: O saldo **nunca** fica negativo: **100%** das saídas maiores que o saldo são recusadas
  com mensagem clara e **0%** delas gravam qualquer dado (nem movimento, nem alteração de saldo).
- **SC-003**: O histórico exibe **todos** os movimentos do item em ordem cronológica, com o saldo
  resultante de cada linha batendo com o saldo atual ao final em **100%** dos casos.
- **SC-004**: **0%** dos movimentos/histórico de um escritório são visíveis ou acessíveis por outro
  escritório; registrar/consultar item de outro escritório retorna `NOT_FOUND`/404 em **100%** dos
  casos.
- **SC-005**: **100%** das tentativas de registrar com quantidade ≤ 0, ou de saída com tipo fora de
  `{adjustment, discard}`, são rejeitadas sem persistir.
- **SC-006**: **100%** das tentativas de registrar/consultar por um membro com papel `client` são
  negadas; apenas `owner`/`collaborator` operam.
- **SC-007**: As suítes `npm run test` (unitário) e `npm run test:integration` (integração) passam,
  incluindo o caminho crítico de **rollback de saída insuficiente**, **histórico com saldo
  resultante** e **isolamento entre escritórios**, validados em **Postgres efêmero** (nunca SQLite);
  `npm run lint` e a checagem de tipos ficam verdes.

## Definição de pronto — testes obrigatórios

Conforme `CLAUDE.md` e a constituição (quality gate), a fatia NÃO é concluída sem os testes abaixo
verdes, além de `npm run lint` e checagem de tipos. Casos críticos multi-tenant/transacionais são
escritos/validados à mão.

- **Unitários (regra/validação/contrato)**: `computeRunningBalance` (saldo resultante por linha,
  incluindo mix de tipos); sinal por tipo (`purchase` `+`; `adjustment`/`discard` `−`); schemas zod
  (`quantity > 0`, `type` restrito na saída, NF opcional); mapeamento de erro para `ActionResult`
  (`INSUFFICIENT_STOCK` → 422, `NOT_FOUND` → 404, `VALIDATION` → 422).
- **Integração — Server Actions/REST contra Postgres efêmero** (`INTEGRATION_*`, **nunca SQLite**):
  entrada incrementa o saldo e cria `purchase`; saída decrementa e cria `adjustment`/`discard`;
  **saída > saldo → `INSUFFICIENT_STOCK` e nada gravado** (rollback comprovado: saldo e contagem de
  movimentos inalterados); histórico ordenado com saldo resultante correto; estado vazio; **404
  cross-tenant** ao registrar/consultar; `FORBIDDEN` para papel `client`.
- **Isolamento multi-tenant** em Postgres efêmero (a suíte `stock-movements-isolation` já existe na
  008; aqui o foco é o comportamento transacional das actions sob tenant ativo).

> Justificativa do Postgres efêmero: o SQLite não tem RLS, `CHECK`, transações com `FOR UPDATE` nem
> `current_setting`; o backstop de isolamento, a não-negatividade do saldo e a atomicidade só podem
> ser provados contra Postgres real (branch efêmera), conforme 004/005/006/009 e a constituição.
> Jamais apontar `INTEGRATION_*` para o banco de dev (as suítes fazem `TRUNCATE`).

## Assumptions

- **A1 — Saldo resultante derivado**: por não haver `balance_after` no modelo 008, o saldo resultante
  é calculado por window function na leitura; coluna materializada foi rejeitada (exigiria migration e
  reescrita histórica).
- **A2 — "Usuário que registrou" omitido**: o modelo 008 não tem `created_by`; a coluna do card não é
  implementada nesta fatia (item futuro, migration própria).
- **A3 — `adjustment` só decremento**: ajuste bidirecional é variação futura (sinal explícito), não
  assumida aqui.
- **A4 — Contrato/autorização reutilizados (007/009)**: `ActionResult<T>`, `officeAction`,
  `requireOfficeStaff()`, paginação offset e padrão de UI/REST já existem e são reusados.
- **A5 — Funcionário no histórico é indireto**: vem por `delivery_id`; só preenchido para movimentos
  `employee_delivery` (gerados por `#19`, fora do escopo). Nesta fatia a coluna em geral fica vazia.
- **A6 — Sem migration nova**: `stock_movements`, `epi_stock` e seus `CHECK`/RLS já existem (008,
  migrations `0007`/`0008`); esta fatia adiciona repositório de movimentos + Server Actions + REST +
  UI.
- **A7 — Modelo B de tenant reutilizado**: escritório ativo via `requireTenantContext()` (005); a
  fatia não introduz nova forma de resolução de tenant.

## Out of Scope

- **Movimento `employee_delivery`** e a baixa de estoque por **entrega de EPI** (`#19`).
- **Devolução/reposição** por devolução (`#20`).
- **CRUD do catálogo de EPI** (`#18`) e do **registro de estoque** (já feito na 009).
- **Coluna "usuário que registrou"** (`created_by`) no histórico — item futuro com migration própria.
- **Saldo resultante materializado** (`balance_after`) — derivado por leitura nesta fatia.
- **Ajuste de inventário bidirecional** (entrada via `adjustment`).
- **Qualquer alteração do modelo 008** (adicionar colunas, mudar `ON DELETE`/`CHECK`) — fatia é
  zero-migration.

## Dependencies

- Fatia **008** (modelo de dados de EPIs): `src/shared/db/schema/epis.ts` (`stock_movements`,
  `epi_stock`, `epi_deliveries`, enum `stock_movement_type`), migrations `0007`/`0008`; suíte
  `stock-movements-isolation`.
- Fatia **009** (CRUD de `epi_stock`): `src/shared/db/repositories/epi-stock.ts`,
  `src/shared/domains/pgr/epi-stock.ts`, telas/REST de `epi-stock` (`balance` read-only,
  `deriveStockStatus`, `countEpiStockDependents`).
- Fatia **007** (CRUD base do PGR): `ActionResult<T>` (`src/shared/server/result.ts`), `officeAction`,
  `requireOfficeStaff()`, padrão de paginação offset, REST `/api/v1/*` e UI de CRUD.
- Fatia **005** (Modelo B de tenant): resolução do escritório ativo (`requireTenantContext()`).
- Fatia **004** (isolamento multi-tenant): `withOrg` + RLS `app_runtime` (backstop) e auditoria de
  fronteira (`.specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md`).
