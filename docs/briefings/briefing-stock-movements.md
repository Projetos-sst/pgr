# Briefing — Movimentações de estoque e histórico (`stock_movements`)

> **Tipo de fatia**: Fluxo/transacional (UI App Router + Server Actions) sobre o modelo `008` —
> **primeira fatia que ESCREVE o saldo** (`epi_stock.balance`), até aqui somente-leitura.
> **Entidade**: `stock_movements` (movimentos tipados que entram/saem do estoque).
> **Operações**: registrar **entrada** (compra) · registrar **saída manual** (ajuste/descarte) ·
> **histórico** de movimentações por item de estoque.
> **Contexto**: Modelo B (tenant = escritório = `orgs.id`); herda padrões de `005`/`006`/`007`/`009`.
> **Depende de**: fatia `008` (`stock_movements`/`epi_stock` em `src/shared/db/schema/epis.ts`,
> migrations `0007`/`0008`) **e** da `009` (CRUD de `epi_stock`, que já trata `balance` como
> read-only e prevê esta fatia em `#72`). Ver §3 e §4 (reconciliações) — **há gaps de modelo, todos
> resolvidos no §11 sem alterar o modelo `008` (zero migration)**.

---

## 1. Objetivo e posição na arquitetura

Entregar o **registro de movimentações de estoque** (entradas e saídas) e a **visualização do
histórico por item**, equivalente a `api/estoquemovimento/` e `/estoque/historico/:id` do ePGR.
Cada movimento é um registro **auditável e tipado** em `stock_movements` que **altera o saldo
materializado** em `epi_stock.balance` dentro de uma transação.

**Esta é a contrapartida da regra de ouro da `009`.** Lá, `balance` era **somente leitura** — "só
muda por movimentações (#72)". **Esta fatia É o #72**: aqui o saldo finalmente é escrito, e
**apenas por aqui** (mais a entrega `#19`, que gera movimento `employee_delivery` automaticamente —
fora do escopo). A `009` entrega o "estado"; esta entrega o "fluxo" que produz esse estado.

Paralelo de padrão: replica a stack da `007`/`009` (contrato `ActionResult`, autorização por papel,
`withOrg`, repositório, REST opcional). A **novidade** é a **escrita transacional do saldo** com
**garantia de não-negatividade** — o ponto técnico central e o maior risco da fatia.

## 2. Padrões herdados (obrigatórios — vêm de 005/006/007/009)

- **Contrato de retorno**: `ActionResult<T> = {ok:true; data} | {ok:false; error:{code,message,fields?}}`
  em `src/shared/server/result.ts` (`ok()`/`fail()`). Server Actions **nunca** lançam exceção crua na UI.
- **Autorização por papel**: `requireOfficeStaff()` sobre `requireTenantContext().role` —
  `owner`/`collaborator` operam; `client` → `ForbiddenError`/403.
- **Isolamento (Modelo B)**: todo acesso via `withOrg(orgId, tx => …)`; tenant ativo de
  `requireTenantContext()`, **nunca** Clerk org / `organization_id` / input do cliente. RLS
  `app_runtime` (`current_setting('app.current_org', true)`) é **backstop**. Já há policy de
  isolamento em `stock_movements` (008) + suíte `stock-movements-isolation.test.ts`.
- **Escrita auditada**: `auditedTenantWrite(orgId, "<evento>", fn)` em toda mutação; `logTenantEvent`
  sem PII. (A `009` usa `epi.epi_stock.write_rejected`; aqui criar evento próprio, ex.
  `epi.stock_movement.write_rejected`.)
- **Validação zod ANTES da regra**; mapa de erros do projeto via `toActionError`/`src/shared/api/rest.ts`:
  `VALIDATION → 422`, `DUPLICATE → 409`, `FK_NOT_FOUND → 422`, `NOT_FOUND → 404`, `FORBIDDEN → 403`.
  **(Mais um código novo necessário nesta fatia — ver §9.)**
- **Repositório / Actions / REST / UI**: espelhar `epi-stock.ts` (repo, `officeAction`, `/api/v1/...`,
  páginas em `src/app/(protected)/epi-stock/`). Paginação offset (`resolvePageParams`, `Paginated<T>`).

## 3. ⚠️ Reconciliação card × repositório real — LER ANTES DE CODAR

O card foi escrito com vocabulário/arquitetura genéricos que **não batem** com o repo. Mesma classe
de divergência da `009`. Resolver na spec para nascer alinhado.

| O que o card diz | O que existe de fato | Ação |
| ---------------- | -------------------- | ---- |
| `features/epis/` (actions/schema/queries/components) | `src/shared/domains/pgr/`, `src/shared/db/repositories/`, `src/shared/server/actions/pgr/`, `src/app/(protected)/epi-stock/`, `src/app/api/v1/epi-stock/` | Usar a estrutura real do projeto |
| `organization_id` (Clerk) como escopo | tenant = `orgs.id` via `requireTenantContext()` + `withOrg`; RLS backstop | **Nunca** usar Clerk org / input; sempre tenant da sessão |
| rota `/estoque/historico/:id` | app usa `/epi-stock`; rota seria `/epi-stock/[id]/history` (ou `/movimentacoes`) | Reconciliar a rota; manter padrão `epi-stock` |
| Integração em **SQLite em memória** | a `009` testa Server Actions contra **Postgres efêmero** (`INTEGRATION_*`), pois depende de CHECK/RLS/transação | Esta fatia depende de `CHECK balance >= 0` + transação → **Postgres efêmero**, não SQLite (ver §10) |
| validação → genérico | padrão do projeto: zod → **422** | Seguir 422 |

## 4. ⚠️ Reconciliação card × modelo real (008) — **GAPS de modelo** (decisões críticas)

O histórico pedido no card exige colunas que **não existem** em `stock_movements`. Este é o ponto
mais importante do briefing. Schema real (`epis.ts`, migration `0007`):

```
stock_movements:
  id, org_id, stock_id (→ epi_stock ON DELETE CASCADE),
  delivery_id (→ epi_deliveries ON DELETE SET NULL, nullable),
  type (enum: purchase | employee_delivery | adjustment | discard),
  quantity (integer, CHECK quantity > 0  ← SEMPRE POSITIVO),
  movement_date (date, default now),
  invoice_number (text, nullable),
  created_at, updated_at
  indexes: org_id, stock_id, delivery_id ; RLS isolation
```

| Coluna pedida no histórico | Existe? | Realidade / ação |
| -------------------------- | ------- | ---------------- |
| Data | ✅ `movement_date` (**`date`**, não timestamp) | Ordenar por `movement_date DESC, created_at DESC` (desempate intra-dia, pois `date` perde a hora) |
| Tipo | ✅ `type` (enum em **inglês**) | Mapear rótulo pt-BR no DTO (compra/entrega/ajuste/descarte) |
| Quantidade | ✅ `quantity` (**sempre > 0**) | O **sinal/efeito é dado pelo `type`**, não pelo valor (ver §5) |
| Nº Nota Fiscal | ✅ `invoice_number` | Opcional; só na entrada (compra) |
| Funcionário (se entrega) | ⚠️ **indireto** | Não há `employee_id` no movimento; vem por `delivery_id → epi_deliveries → employee_id → employees`. Movimentos `employee_delivery` são gerados por `#19` (fora do escopo) |
| **Saldo Resultante** | ❌ **NÃO EXISTE** | Não há coluna `balance_after`. **Resolvido (§11.1)**: derivar por soma acumulada (window function), **sem coluna** |
| **Usuário que registrou** | ❌ **NÃO EXISTE** | Não há `created_by`/`user_id`. **Resolvido (§11.2)**: **omitir** desta fatia (sem migration); item futuro |

> **Resumo dos gaps**: o modelo `008` cobre tipo/quantidade/data/NF/entrega, mas **não** tem "saldo
> resultante" nem "usuário que registrou". A spec precisa decidir explicitamente cada um. Sem isso,
> dois itens do card ficam sem origem de dados.

## 5. Lógica central — o sinal vem do TIPO, e o saldo é transacional

`quantity` é **sempre positivo** (`CHECK quantity > 0`). O efeito no saldo é determinado pelo `type`:

| `type` | Direção | Nesta fatia? | Origem |
| ------ | ------- | ------------ | ------ |
| `purchase` (compra) | **+** entrada | ✅ "Registrar entrada" | manual (modal) |
| `adjustment` (ajuste) | **−** saída¹ | ✅ "Registrar saída manual" | manual (modal) |
| `discard` (descarte) | **−** saída | ✅ "Registrar saída manual" | manual (modal) |
| `employee_delivery` (entrega) | **−** saída | ❌ **fora** | gerado por `#19` (entrega de EPI) |

> ¹ **Decisão travada (§11.3)**: `adjustment` = **saída (decremento)** nesta fatia. Em sistemas de
> inventário "ajuste" costuma ser bidirecional (+/−), mas aqui fica **só decremento** (como o card).
> Ajuste para cima é variação futura (sinal explícito), não assumida aqui.

**Cada movimento = 1 transação atômica** (o coração da fatia):

1. `SELECT ... FOR UPDATE` do `epi_stock` (trava a linha do item no tenant) → lê `balance` atual.
2. Calcula `novoSaldo = balance ± quantity` conforme o `type`.
3. **Valida `novoSaldo >= 0`** na aplicação → se negativo, **aborta** com erro claro (não confia só no CHECK).
4. `INSERT` em `stock_movements` (org_id do tenant, stock_id, type, quantity, movement_date, invoice_number?).
5. `UPDATE epi_stock SET balance = novoSaldo` (mesma transação).

Se qualquer passo falhar, **rollback** — nunca um movimento sem ajuste de saldo, nem saldo sem
movimento. O `CHECK balance >= 0` do banco é o **backstop** caso a validação da app falhe; a app
valida antes para devolver uma mensagem amigável em vez de erro de constraint.

## 6. Operações (repositório `epi-stock.ts`/novo módulo + Server Actions)

Todas org-scopadas (`requireTenantContext()` → `requireOfficeStaff()` → `withOrg`). Sugestão de
assinaturas (espelhando `epi-stock.ts`):

| Operação | Assinatura (repo) | Comportamento |
| -------- | ----------------- | ------------- |
| **Registrar entrada** | `registerStockEntry(orgId, {stockId, quantity, movementDate, invoiceNumber?})` | Transação §5 com `type='purchase'`, `+quantity`; valida estoque existe e é do tenant (senão 404); `quantity > 0` (zod); auditado |
| **Registrar saída** | `registerStockExit(orgId, {stockId, quantity, movementDate, type})` onde `type ∈ {adjustment, discard}` | Transação §5 com `−quantity`; **valida saldo suficiente** → saldo negativo retorna erro (`INSUFFICIENT_STOCK`/422); 404 cross-tenant; auditado |
| **Histórico** | `listStockMovements(orgId, stockId, {page,pageSize})` | Movimentos do item no tenant, ordenados `movement_date DESC, created_at DESC`; **saldo resultante derivado** (§8); join opcional em funcionário via `delivery_id`; `Paginated<T>`; estoque de outro tenant → vazio/404 |
| *(já existe)* | `countEpiStockDependents` (009) | Conta movimentos — reusável; nada a fazer |

**Tipo de retorno do registro**: devolver o saldo resultante (`{movement, newBalance}`) para a UI
atualizar sem refetch.

## 7. UI (App Router)

- **Modal "Registrar entrada"** (na tela da `009`, por item): campos `Data de entrada`,
  `Quantidade`, `Nº Nota Fiscal` (opcional) → "Confirmar entrada".
- **Modal "Registrar saída manual"**: `Data`, `Quantidade`, `Tipo de saída` (ajuste/descarte).
- **Tela de histórico** `/epi-stock/[id]/history` (reconciliar a rota do card `/estoque/historico/:id`):
  Server Component com a query do §6 — tabela Data · Tipo · Quantidade · **Saldo Resultante** ·
  Nº NF · Funcionário (quando `employee_delivery`). **Sem coluna "Usuário"** (decisão §11.2).
- **Estado vazio** no histórico (item sem movimentos).
- Reaproveitar `status-badge`/padrões visuais da `009`. Após registrar, refletir o **novo saldo** e o
  novo **status derivado** na listagem da `009`.

## 8. Saldo Resultante no histórico — sem coluna (derivado)

Como não há `balance_after` (§4), o "saldo resultante" de cada linha é a **soma acumulada** dos
efeitos (compra `+`, demais `−`) em ordem cronológica:

- **Recomendado**: calcular por **window function** (`SUM(signed_quantity) OVER (ORDER BY
  movement_date, created_at)`) na query do histórico, onde `signed_quantity = CASE WHEN type =
  'purchase' THEN quantity ELSE -quantity END`. Casa com o `balance` atual de `epi_stock` desde que
  todos os movimentos passem por esta camada.
- **Cuidado de consistência**: o acumulado só bate com `epi_stock.balance` se **nenhum** saldo for
  escrito fora desta fatia. Como a `009` garante `balance` read-only e o seed inicia coerente, isso
  vale; documentar a invariante. (Alternativa rejeitada: coluna `balance_after` materializada — exige
  migration e reescrita histórica; fora do escopo de fluxo.)
- **Função pura testável**: extrair `computeRunningBalance(movements)` (espelho do window) para unit
  test, como a `009` fez com `deriveStockStatus`.

## 9. Validação, erros e auditoria

- **zod**: `stockEntrySchema` (`stockId` uuid, `quantity` int > 0, `movementDate` date, `invoiceNumber`
  opcional/trim) e `stockExitSchema` (`stockId` uuid, `quantity` int > 0, `movementDate` date,
  `type ∈ {adjustment, discard}`). Em `src/shared/domains/pgr/`.
- **Erros**: além dos herdados, **novo código** para saldo insuficiente — ex. `INSUFFICIENT_STOCK`
  → **422** (mensagem: "Saldo insuficiente: disponível X, solicitado Y"). Mapear em `rest.ts`.
  `stock_id` inexistente/outro tenant → **404** (`NOT_FOUND`). `quantity ≤ 0` → **422**.
- **Auditoria**: `auditedTenantWrite` + `logTenantEvent` (sem PII) em entrada/saída.

## 10. Concorrência, atomicidade e testes

- **Atomicidade**: `withOrg` já roda em transação; usar `SELECT … FOR UPDATE` na linha do `epi_stock`
  para serializar duas saídas concorrentes do mesmo item (evita "double spend" que furaria o saldo).
- **Backstop**: `CHECK balance >= 0` garante que mesmo uma corrida que escape da validação não grava
  saldo negativo (a transação aborta).
- **Testes (quality gate — obrigatórios)**:
  - **Unit**: `computeRunningBalance` (saldo resultante por linha); sinal por tipo
    (compra `+`, ajuste/descarte `−`); schemas zod (`quantity > 0`, `type` restrito, NF opcional).
  - **Integração (Server Actions) — Postgres efêmero** (`INTEGRATION_*`, **nunca SQLite**, pois
    depende do `CHECK`, da transação e do `FOR UPDATE`): entrada incrementa saldo e cria movimento
    `purchase`; saída decrementa e cria `adjustment`/`discard`; **saída > saldo → erro e nada é
    gravado** (rollback: nem movimento, nem alteração de saldo); histórico ordenado com saldo
    resultante correto; estado vazio; **404 cross-tenant** ao mover/consultar estoque de outro
    escritório; `FORBIDDEN` para `client`.
  - **Isolamento multi-tenant** em Postgres efêmero (`stock-movements-isolation` já existe na 008;
    aqui o foco é o comportamento transacional das actions sob tenant ativo).
  - `npm run test` e `npm run test:integration` verdes; `npm run lint` + tipos verdes.

> ⚠️ O card pede "SQLite em memória" para integração — **diverge do CLAUDE.md/constituição** para
> fatias que dependem de CHECK/triggers/transação/RLS. Esta fatia depende. **Usar Postgres efêmero**,
> como a `009`. Jamais apontar `INTEGRATION_*` para o Supabase de dev (as suítes fazem `TRUNCATE`).

## 11. Decisões RESOLVIDAS (travadas — sem ambiguidade para o código)

Todas as decisões abaixo estão **fechadas**. A spec e a implementação devem segui-las à risca;
**nenhuma** muda o modelo `008` (zero migration nesta fatia).

1. **"Saldo Resultante"** → **derivado por window function** na query do histórico
   (`SUM(CASE WHEN type='purchase' THEN quantity ELSE -quantity END) OVER (ORDER BY movement_date,
   created_at)`). **Sem coluna `balance_after`, sem migration.** (§8)
2. **"Usuário que registrou"** → **OMITIDO** desta fatia (o modelo `008` não tem `created_by` e não
   será alterado aqui). A coluna do histórico do card **não é implementada**; fica registrada como
   item futuro (migration própria). (§4)
3. **`adjustment`** → **somente saída (decremento)**. Sem ajuste bidirecional nesta fatia. Saída
   manual aceita apenas `type ∈ {adjustment, discard}`. (§5)
4. **Rota do histórico** → **`/epi-stock/[id]/history`** (padrão `epi-stock` do projeto). A rota
   ePGR `/estoque/historico/:id` do card **não** é usada. (§3/§7)
5. **Saldo insuficiente** → novo código **`INSUFFICIENT_STOCK → 422`** em `src/shared/api/rest.ts`,
   mensagem clara ("Saldo insuficiente: disponível X, solicitado Y"). (§9)
6. **REST** → **incluir** `/api/v1/epi-stock/[id]/movements` (entrada/saída + histórico), alinhado a
   `epi-stock` e testável no Postman. (§7)
7. **`movement_date` é `date`** (sem hora) → ordenar **`movement_date DESC, created_at DESC`**; a UI
   exibe **apenas a data**. (§4/§6)
8. **Atomicidade/concorrência** → toda escrita de saldo em **transação** (`withOrg`) com
   **`SELECT … FOR UPDATE`** na linha de `epi_stock`; validação `≥ 0` na app + `CHECK balance >= 0`
   como backstop. Nunca movimento sem ajuste de saldo, nem saldo sem movimento. (§5/§10)
9. **Testes de integração** → **Postgres efêmero** (`INTEGRATION_*`), **nunca SQLite** e **nunca** o
   banco de dev (suítes fazem `TRUNCATE`). (§10)
10. **Vocabulário** → `type` no banco em inglês (`purchase`/`adjustment`/`discard`/`employee_delivery`);
    **rótulos pt-BR só no DTO/UI** (compra/ajuste/descarte/entrega). Sem renomear enum. (§4)

## 12. Fora de escopo (explícito)

- Movimento `employee_delivery` (gerado pela **entrega de EPI**, `#19`) e a baixa por entrega.
- Devolução/reposição por devolução (`#20`).
- CRUD do **catálogo** (`#18`) e do **registro de estoque** (já feito na `009`).
- Qualquer alteração do **modelo `008`** (adicionar `created_by`, `balance_after`, mudar ON DELETE) —
  só se uma decisão acima exigir, em migration própria.
- Ajuste de inventário bidirecional (se §11.3 ficar como "só saída").

## 13. Critérios de aceite (do card, reconciliados)

- [ ] **Entrada** cria movimento `purchase` e **incrementa** `balance` corretamente (transação).
- [ ] **Saída manual** cria `adjustment`/`discard` e **decrementa** `balance` (transação).
- [ ] **Saldo nunca negativo**: saída > saldo retorna erro claro e **não grava nada** (rollback);
  `CHECK balance >= 0` como backstop.
- [ ] **Histórico** exibe todos os movimentos do item com data, tipo, quantidade e **saldo resultante**
  (derivado), ordenado cronologicamente; **estado vazio** tratado.
- [ ] **Nº Nota Fiscal** opcional na entrada, exibido quando preenchido.
- [ ] **Funcionário** exibido quando o movimento veio de entrega (`employee_delivery` via `delivery_id`).
- [ ] Tudo **escopado pela organização ativa**; movimento/histórico de outro escritório nunca aparece
  nem é acessível (RLS backstop / 404).
- [ ] `npm run test` e `npm run test:integration` (incl. isolamento em Postgres efêmero) verdes.

## 14. Referências

- Modelo-base: **fatia `008`** — `.specs/008-epi-data-model/`, `src/shared/db/schema/epis.ts`
  (`stock_movements`, `epi_stock`), migrations `0007`/`0008`.
- Fatia anterior (saldo read-only): **`009`** — `docs/briefings/briefing-epi-stock-crud.md`,
  `src/shared/db/repositories/epi-stock.ts` (regra "`balance` só muda por `#72`" = esta fatia).
- Padrões: **`007`** — `src/shared/server/result.ts`; repos `companies.ts`/`ges.ts`; `src/app/api/v1/*`.
- Isolamento: `.specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md`.
- Paridade ePGR: `.specs/004-epgr-feature-parity/03-epi-estoque.md` (seção 2). Constituição v1.2.1 —
  Princípios I (Modelo B) e V (integridade no banco).

---

## 15. Prompt para `/speckit-specify` (reconciliado com o repo real)

> Copie o bloco abaixo (começa em `/speckit-specify`) e rode. Já incorpora as reconciliações dos §3/§4
> (estrutura real do projeto, nomes/colunas reais do `008`, gaps de "saldo resultante" e "usuário")
> para a spec nascer alinhada ao que existe.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/stock-movements

Feature: Movimentações de estoque e histórico (stock_movements)

CONTEXTO E OBJETIVO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria
(1 issue = 1 branch = 1 spec). Entrega o registro de MOVIMENTAÇÕES de estoque (entradas e saídas
manuais) e o HISTÓRICO de movimentações por item, equivalente a api/estoquemovimento/ e
/estoque/historico/:id do ePGR. É o "fluxo" sobre a fundação de dados da 008 e a contrapartida da
009: nesta fatia o saldo (epi_stock.balance), que na 009 é SOMENTE LEITURA, finalmente é escrito —
e apenas por aqui (mais a entrega #19, fora do escopo). Leia .specs/008-*, .specs/009-* / o briefing
docs/briefings/briefing-epi-stock-crud.md, os repositórios epi-stock.ts/companies.ts/ges.ts, o
contrato src/shared/server/result.ts e o schema src/shared/db/schema/epis.ts antes de escrever a
spec. Liste os arquivos que vai ler.

MODELO JÁ EXISTENTE (não criar/alterar) — colunas REAIS de stock_movements (epis.ts, migration 0007):
- id, org_id (tenant), stock_id (FK -> epi_stock ON DELETE CASCADE),
- delivery_id (FK -> epi_deliveries ON DELETE SET NULL, nullable),
- type (enum stock_movement_type: purchase | employee_delivery | adjustment | discard),
- quantity (integer, CHECK quantity > 0  -> SEMPRE POSITIVO; o sinal vem do type),
- movement_date (date, default now), invoice_number (text, nullable), timestamps.
- epi_stock.balance (integer, CHECK balance >= 0) é o saldo materializado a manter.
ATENÇÃO aos GAPS de modelo (decidir na spec):
- NÃO existe coluna "saldo resultante" (balance_after) -> derivar por soma acumulada na query
  (window function), sem coluna.
- NÃO existe coluna "usuário que registrou" (created_by) -> OMITIR desta fatia (ou migration
  própria em fatia futura). Não inventar a coluna.
- "Funcionário" no histórico é indireto: só para movimentos employee_delivery, via
  delivery_id -> epi_deliveries -> employee_id (e employee_delivery é gerado por #19, fora do escopo).

REGRAS NÃO-NEGOCIÁVEIS (constituição / Modelo B):
- Tenant ativo = escritório = orgs.id via requireTenantContext() + withOrg(); NUNCA Clerk org,
  organization_id nem input do cliente. RLS app_runtime é backstop.
- Autorização por papel: requireOfficeStaff() (owner/collaborator operam; client -> 403).
- Toda Server Action valida com zod ANTES da regra e retorna ActionResult<T> (ok/fail); escrita
  auditada (auditedTenantWrite/logTenantEvent) sem PII. Erros: padrão do projeto (zod -> 422,
  NOT_FOUND -> 404, FORBIDDEN -> 403) + novo INSUFFICIENT_STOCK -> 422.
- Estrutura real do projeto (NÃO "features/epis/"): domínio em src/shared/domains/pgr/, repositório
  em src/shared/db/repositories/, Server Actions em src/shared/server/actions/pgr/, UI em
  src/app/(protected)/epi-stock/, REST em src/app/api/v1/.

LÓGICA CENTRAL (transação atômica por movimento):
- Tipos nesta fatia: purchase (entrada, +), adjustment e discard (saída manual, -). employee_delivery
  fica FORA (gerado por #19). quantity é sempre positivo; o efeito no saldo vem do type.
- Cada registro: SELECT ... FOR UPDATE da linha de epi_stock (trava), calcula novoSaldo = balance +/-
  quantity, VALIDA novoSaldo >= 0 na aplicação (erro claro se negativo), INSERT em stock_movements +
  UPDATE epi_stock.balance, tudo em UMA transação. Falhou -> rollback (nunca movimento sem saldo, nem
  saldo sem movimento). CHECK balance >= 0 é backstop.
- adjustment é tratado como SAÍDA (decremento) nesta fatia (sem ajuste bidirecional).

OPERAÇÕES (repositório + Server Actions + REST):
- registerStockEntry({stockId, quantity, movementDate, invoiceNumber?}): type=purchase, +quantity;
  estoque inexistente/outro tenant -> 404; quantity <= 0 -> 422; retorna {movement, newBalance}.
- registerStockExit({stockId, quantity, movementDate, type in {adjustment, discard}}): -quantity;
  saldo insuficiente -> INSUFFICIENT_STOCK (422) e nada gravado; 404 cross-tenant.
- listStockMovements(stockId, {page,pageSize}): movimentos do item no tenant, ordem
  movement_date DESC, created_at DESC; SALDO RESULTANTE derivado por window function
  (SUM(CASE WHEN type='purchase' THEN quantity ELSE -quantity END) OVER (ORDER BY ...)); join opcional
  no funcionário via delivery_id; estado vazio; outro tenant -> vazio/404.

UI (App Router, em src/app/(protected)/epi-stock/):
- Modal "Registrar entrada" (data, quantidade, nº nota fiscal opcional).
- Modal "Registrar saída manual" (data, quantidade, tipo: ajuste/descarte).
- Tela de histórico por item em /epi-stock/[id]/history (reconciliando /estoque/historico/:id do card):
  Server Component, tabela Data · Tipo (rótulo pt-BR) · Quantidade · Saldo Resultante · Nº NF ·
  Funcionário (quando entrega); estado vazio. Após registrar, refletir novo saldo/status na listagem.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero registrar entradas de estoque (compra) para que o saldo seja
  atualizado automaticamente.
- (P2) Como gestor de SST, quero registrar saídas manuais (ajuste/descarte) e consultar o histórico
  completo de movimentações de um item, com o saldo resultante de cada movimento.

Success criteria mensuráveis (tecnologia-agnósticos):
- O saldo do item é atualizado imediatamente após registrar uma entrada ou saída.
- O saldo nunca fica negativo: uma saída maior que o saldo é recusada e nada é gravado.
- O histórico exibe todos os movimentos do item em ordem cronológica, com o saldo resultante de cada um.
- Movimentações de outro escritório nunca aparecem nem são acessíveis (404 cross-tenant).

Edge cases:
- Saída com quantidade maior que o saldo disponível (recusar; rollback total).
- Entrada/saída com quantidade zero ou negativa (422).
- Item de estoque de outra organização (404 em registrar/consultar).
- Histórico com muitas movimentações (paginação) e histórico vazio (estado vazio).
- movement_date é uma data (sem hora): empate intra-dia desempatado por created_at.

DECISÕES A REGISTRAR NA SPEC:
- Saldo resultante: derivado por window function (sem coluna nova).
- "Usuário que registrou": omitido nesta fatia (modelo não tem created_by).
- adjustment = saída (decremento), sem ajuste bidirecional.
- Incluir REST /api/v1 das movimentações (alinha com epi-stock; testável no Postman).
- Integração de Server Actions roda contra Postgres EFÊMERO (não SQLite), por depender de
  CHECK/transação/FOR UPDATE/RLS; jamais apontar para o banco de dev (suítes fazem TRUNCATE).

TESTES OBRIGATÓRIOS (quality gate):
- Unit: computeRunningBalance (saldo resultante por linha); sinal por tipo; schemas zod (quantity>0,
  type restrito a adjustment/discard na saída, NF opcional).
- Integração (Postgres efêmero, INTEGRATION_*, NUNCA SQLite): entrada incrementa e cria purchase;
  saída decrementa e cria adjustment/discard; saída > saldo -> erro e nada gravado (rollback);
  histórico ordenado com saldo resultante correto; estado vazio; 404 cross-tenant; FORBIDDEN p/ client.
- Isolamento multi-tenant em Postgres efêmero. npm run test e npm run test:integration verdes;
  lint + tipos verdes.

FORA DE ESCOPO:
- Movimento employee_delivery e baixa por entrega (#19); devolução (#20); CRUD do catálogo (#18) e do
  registro de estoque (#009, já feito); qualquer alteração do modelo 008 (created_by, balance_after,
  ON DELETE); ajuste de inventário bidirecional.

REFERÊNCIAS:
- Modelo-base: .specs/008-epi-data-model/ (epis.ts; migrations 0007/0008).
- Fatia anterior: 009 (docs/briefings/briefing-epi-stock-crud.md; repositories/epi-stock.ts).
- Padrão de CRUD/fluxo: .specs/007-pgr-base-cruds/; src/shared/server/result.ts;
  repositories/{companies,ges}.ts; src/app/api/v1/*.
- Paridade ePGR: .specs/004-epgr-feature-parity/03-epi-estoque.md (seção 2).
- Constituição v1.2.1 — Princípios I (Modelo B) e V (integridade).

Conteúdo da spec em pt-BR; branch e commits em inglês.
NÃO invente solução técnica não descrita aqui — descreva o "o quê" e o "porquê".
```

---

## 16. Prompt DETALHADO para `/speckit-specify` (todo o detalhamento)

> Versão **completa e definitiva** — embute **todas** as 10 decisões travadas (§11), as **colunas
> reais** do modelo `008`, os padrões herdados (`007`/`009`), os arquivos a ler, as assinaturas de
> repositório/actions, o mapa de erros e a forma dos endpoints REST. Copie o bloco inteiro (começa em
> `/speckit-specify`) e rode. Substitui o §15 quando você quiser o máximo de contexto.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/stock-movements

Feature: Movimentações de estoque e histórico (stock_movements) — UI + Server Actions + REST

CONTEXTO E OBJETIVO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria
(1 issue = 1 branch = 1 spec). Entrega o registro de MOVIMENTAÇÕES de estoque (entradas e saídas
manuais) e o HISTÓRICO de movimentações por item de estoque, equivalente a api/estoquemovimento/ e
/estoque/historico/:id do ePGR. É a camada de FLUXO sobre a fundação de dados da 008 e a
contrapartida da 009: na 009 o saldo (epi_stock.balance) é SOMENTE LEITURA ("só muda por #72");
ESTA fatia É o #72 — aqui o saldo é escrito, e apenas por aqui (mais a entrega #19, fora do escopo).

ANTES DE ESCREVER A SPEC, leia e liste estes arquivos:
- src/shared/db/schema/epis.ts (tabelas stock_movements, epi_stock, epi_deliveries; enums)
- src/shared/db/repositories/epi-stock.ts (padrão de repo, withOrg, listColumns, deriveStockStatus,
  countEpiStockDependents)
- src/shared/domains/pgr/epi-stock.ts (schemas zod, DTOs, mappers, deriveStockStatus)
- src/shared/server/actions/pgr/epi-stock.ts (officeAction, ActionResult)
- src/shared/server/result.ts (contrato ok/fail), src/shared/api/rest.ts (mapa de erros HTTP)
- src/app/api/v1/epi-stock/* e src/app/(protected)/epi-stock/* (REST e UI da 009)
- src/__tests__/integration/pgr/epi-stock.test.ts e _helpers/{db,pgr-seed}.ts (padrão de teste)
- src/__tests__/integration/shared/db/stock-movements-isolation.test.ts (isolamento já existente)
- .specs/008-epi-data-model/, .specs/009-* (ou docs/briefings/briefing-epi-stock-crud.md), .specs/007-*
- docs/briefings/briefing-stock-movements.md (este briefing — fonte das decisões)

MODELO JÁ EXISTENTE (NÃO criar/alterar — ZERO migration nesta fatia). Colunas REAIS:
stock_movements (epis.ts, migration 0007):
- id (uuid PK), org_id (text, tenant -> orgs ON DELETE CASCADE),
- stock_id (uuid -> epi_stock ON DELETE CASCADE),
- delivery_id (uuid -> epi_deliveries ON DELETE SET NULL, NULLABLE),
- type (enum stock_movement_type: 'purchase' | 'employee_delivery' | 'adjustment' | 'discard'),
- quantity (integer, CHECK quantity > 0  -> SEMPRE POSITIVO; o sinal vem do type),
- movement_date (date, default now  -> é DATE, sem hora),
- invoice_number (text, NULLABLE),
- created_at, updated_at; indexes em org_id, stock_id, delivery_id; RLS isolation policy.
epi_stock: balance (integer, CHECK balance >= 0) é o saldo MATERIALIZADO a manter; min_quantity
(integer, CHECK >= 0); UNIQUE(org_id, catalog_id); catalog_id -> epi_catalog.
GAPS de modelo (NÃO inventar coluna — resolver como abaixo):
- NÃO existe "saldo resultante" (balance_after) -> derivar por soma acumulada (window function).
- NÃO existe "usuário que registrou" (created_by) -> OMITIR desta fatia (item futuro).
- "Funcionário" no histórico é INDIRETO: só para type='employee_delivery', via
  delivery_id -> epi_deliveries -> employee_id -> employees (e employee_delivery vem de #19, fora).

DECISÕES TRAVADAS (devem constar na spec — todas definitivas, zero migration):
1. Saldo resultante: derivado por window function, sem coluna.
2. "Usuário que registrou": OMITIDO (modelo não tem created_by).
3. adjustment = SAÍDA (decremento). Sem ajuste bidirecional. Saída aceita só type in {adjustment, discard}.
4. Rota do histórico: /epi-stock/[id]/history (padrão do projeto), não /estoque/historico/:id.
5. Saldo insuficiente: novo erro INSUFFICIENT_STOCK -> 422 (mensagem "Saldo insuficiente:
   disponível X, solicitado Y") em src/shared/api/rest.ts.
6. REST incluído: /api/v1/epi-stock/[id]/movements (POST entrada/saída; GET histórico paginado).
7. Ordenação do histórico: movement_date DESC, created_at DESC; UI exibe só a data.
8. Atomicidade: escrita de saldo em transação (withOrg) com SELECT ... FOR UPDATE na linha de
   epi_stock; validação >= 0 na app + CHECK balance >= 0 como backstop.
9. Testes de integração: Postgres EFÊMERO (INTEGRATION_*), NUNCA SQLite, NUNCA o banco de dev.
10. Vocabulário: type em inglês no banco; rótulos pt-BR só no DTO/UI
    (purchase=compra, adjustment=ajuste, discard=descarte, employee_delivery=entrega).

REGRAS NÃO-NEGOCIÁVEIS (constituição / Modelo B):
- Tenant ativo = escritório = orgs.id via requireTenantContext() + withOrg(); NUNCA Clerk org,
  organization_id nem input do cliente. RLS app_runtime (current_setting('app.current_org')) é backstop.
- Autorização por papel: requireOfficeStaff() (owner/collaborator operam; client -> 403/FORBIDDEN),
  inclusive em leituras.
- Toda Server Action valida com zod ANTES da regra e retorna ActionResult<T> (ok/fail), sem lançar
  exceção crua na UI. Escrita auditada via auditedTenantWrite + logTenantEvent (sem PII); evento
  sugerido epi.stock_movement.write_rejected.
- Banco é fonte de verdade (constraints); a validação na app dá mensagem amigável antes do CHECK.
- Estrutura real do projeto (NÃO "features/epis/"): domínio src/shared/domains/pgr/, repositório
  src/shared/db/repositories/, actions src/shared/server/actions/pgr/, UI src/app/(protected)/epi-stock/,
  REST src/app/api/v1/.

LÓGICA CENTRAL (transação atômica por movimento — o coração da fatia):
- Tipos NESTA fatia: purchase (entrada, +quantity); adjustment e discard (saída manual, -quantity).
  employee_delivery fica FORA (gerado por #19). quantity sempre > 0; o efeito no saldo vem do type.
- Cada registro, numa ÚNICA transação:
  1) SELECT ... FOR UPDATE da linha de epi_stock (trava o item no tenant; 404 se não existir/for de
     outro escritório);
  2) novoSaldo = balance + quantity (entrada) ou balance - quantity (saída);
  3) VALIDA novoSaldo >= 0 na aplicação; se < 0 -> INSUFFICIENT_STOCK (422) e ROLLBACK (nada gravado);
  4) INSERT em stock_movements (org_id do tenant, stock_id, type, quantity, movement_date,
     invoice_number? só na entrada);
  5) UPDATE epi_stock SET balance = novoSaldo (mesma transação).
  Falha em qualquer passo -> rollback total. Nunca movimento sem ajuste de saldo, nem saldo sem
  movimento. CHECK balance >= 0 do banco é o backstop.

OPERAÇÕES (repositório src/shared/db/repositories/<...>.ts + Server Actions + REST):
- registerStockEntry(orgId, {stockId, quantity, movementDate, invoiceNumber?}): transação com
  type='purchase', +quantity; estoque inexistente/outro tenant -> 404; quantity <= 0 -> 422; retorna
  {movement, newBalance}; auditado.
- registerStockExit(orgId, {stockId, quantity, movementDate, type in {adjustment, discard}}):
  transação com -quantity; saldo insuficiente -> INSUFFICIENT_STOCK (422) e nada gravado; 404
  cross-tenant; retorna {movement, newBalance}; auditado.
- listStockMovements(orgId, stockId, {page, pageSize}): movimentos do item no tenant; ordem
  movement_date DESC, created_at DESC; SALDO RESULTANTE derivado por window function
  (SUM(CASE WHEN type='purchase' THEN quantity ELSE -quantity END) OVER (ORDER BY movement_date,
  created_at)); LEFT JOIN epi_deliveries+employees para nome do funcionário quando
  type='employee_delivery'; Paginated<T>; sem tenant/outro tenant -> vazio/404.
- (reuso) countEpiStockDependents (009): já conta movimentos; nada a fazer.
- Função pura computeRunningBalance(movements) (espelho do window) para unit test.

VALIDAÇÃO / ERROS:
- zod: stockEntrySchema (stockId uuid; quantity int > 0; movementDate date; invoiceNumber opcional+trim);
  stockExitSchema (stockId uuid; quantity int > 0; movementDate date; type in {adjustment, discard}).
- Mapa de erros (src/shared/api/rest.ts): VALIDATION->422, NOT_FOUND->404, FORBIDDEN->403,
  FK_NOT_FOUND->422, DUPLICATE->409, e NOVO INSUFFICIENT_STOCK->422.

UI (App Router, src/app/(protected)/epi-stock/):
- Modal "Registrar entrada": Data de entrada, Quantidade, Nº Nota Fiscal (opcional) -> "Confirmar entrada".
- Modal "Registrar saída manual": Data, Quantidade, Tipo de saída (Ajuste / Descarte).
- Tela de histórico /epi-stock/[id]/history (Server Component): tabela Data · Tipo (rótulo pt-BR) ·
  Quantidade · Saldo Resultante · Nº NF · Funcionário (quando entrega). SEM coluna "Usuário".
  Estado vazio orientando o usuário. Paginação. Após registrar, refletir novo saldo e novo status
  derivado na listagem da 009.

REST (src/app/api/v1/epi-stock/[id]/movements):
- POST (body discrimina entrada vs saída por type/ação) -> registra movimento; respostas 201/422/404/403.
- GET (paginado) -> histórico do item com saldo resultante; 200/404/403. Testável no Postman.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero registrar entradas de estoque (compra) para que o saldo do item seja
  atualizado automaticamente e de forma confiável.
- (P2) Como gestor de SST, quero registrar saídas manuais (ajuste/descarte) e consultar o histórico
  completo de movimentações de um item, vendo o saldo resultante de cada movimento.

Success criteria mensuráveis (tecnologia-agnósticos):
- O saldo do item é atualizado imediatamente após registrar uma entrada ou saída.
- O saldo NUNCA fica negativo: uma saída maior que o saldo é recusada com mensagem clara e NADA é
  gravado (nem movimento, nem alteração de saldo).
- O histórico exibe todos os movimentos do item em ordem cronológica, com o saldo resultante de cada um.
- Movimentações de outro escritório nunca aparecem nem são acessíveis (404 cross-tenant).

Edge cases:
- Saída com quantidade maior que o saldo disponível (recusar; rollback total).
- Entrada/saída com quantidade zero ou negativa (422).
- Item de estoque de outra organização (404 ao registrar/consultar).
- Histórico com muitas movimentações (paginação) e histórico vazio (estado vazio).
- movement_date é DATE (sem hora): empate intra-dia desempatado por created_at.
- Saída manual NÃO aceita type='purchase' nem 'employee_delivery' (422/validação).
- Concorrência: duas saídas simultâneas do mesmo item não podem furar o saldo (FOR UPDATE serializa).

TESTES OBRIGATÓRIOS (quality gate — a fatia não fecha sem eles):
- Unit: computeRunningBalance (saldo resultante por linha, incl. mix de tipos); sinal por tipo
  (purchase + ; adjustment/discard -); schemas zod (quantity > 0; type restrito na saída; NF opcional).
- Integração (Postgres EFÊMERO, INTEGRATION_*, runIsolationSuite/seed; NUNCA SQLite; suítes fazem
  TRUNCATE -> jamais no banco de dev): entrada incrementa saldo e cria 'purchase'; saída decrementa e
  cria 'adjustment'/'discard'; saída > saldo -> INSUFFICIENT_STOCK e NADA gravado (rollback comprovado:
  saldo e contagem de movimentos inalterados); histórico ordenado com saldo resultante correto; estado
  vazio; 404 cross-tenant ao registrar/consultar; FORBIDDEN para papel client.
- Isolamento multi-tenant em Postgres efêmero (dados não cruzam organizações).
- npm run test e npm run test:integration verdes; npm run lint + tipos (tsc --noEmit) verdes.

CRITÉRIOS DE ACEITE:
- Entrada cria 'purchase' e incrementa o saldo corretamente (transação).
- Saída manual cria 'adjustment'/'discard' e decrementa o saldo (transação).
- Saldo nunca negativo: saída > saldo retorna erro claro e não grava nada; CHECK balance >= 0 backstop.
- Histórico lista todos os movimentos com data, tipo, quantidade e saldo resultante (derivado),
  ordenado cronologicamente; estado vazio tratado.
- Nº Nota Fiscal opcional na entrada, exibido quando preenchido.
- Funcionário exibido quando o movimento vem de entrega (employee_delivery via delivery_id).
- Tudo escopado pela organização ativa; movimento/histórico de outro escritório nunca aparece (404).
- Testes (unit + integração incl. isolamento em Postgres efêmero) verdes.

FORA DE ESCOPO:
- Movimento employee_delivery e baixa por entrega (#19); devolução/reposição (#20); CRUD do catálogo
  (#18) e do registro de estoque (009, já feito); qualquer alteração do modelo 008 (created_by,
  balance_after, ON DELETE); ajuste de inventário bidirecional; coluna "Usuário" no histórico.

REFERÊNCIAS:
- Modelo-base: .specs/008-epi-data-model/ (src/shared/db/schema/epis.ts; migrations 0007/0008).
- Fatia anterior (saldo read-only): 009 (docs/briefings/briefing-epi-stock-crud.md;
  src/shared/db/repositories/epi-stock.ts).
- Padrão de CRUD/fluxo: .specs/007-pgr-base-cruds/; src/shared/server/result.ts;
  src/shared/db/repositories/{companies,ges}.ts; src/app/api/v1/*.
- Isolamento: .specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md.
- Paridade ePGR: .specs/004-epgr-feature-parity/03-epi-estoque.md (seção 2).
- Constituição v1.2.1 — Princípios I (Modelo B) e V (integridade no banco).

Conteúdo da spec em pt-BR; branch e commits em inglês.
NÃO invente solução técnica não descrita aqui — descreva o "o quê" e o "porquê". Não altere o modelo
008; esta fatia é zero-migration.
```
