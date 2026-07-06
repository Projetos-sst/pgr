# Briefing — Devolução de EPI (`ppe-return-record`)

> **Tipo de fatia**: Fluxo de escrita transacional (Server Action + UI) sobre o modelo `008`, **com
> migration** (ao contrário da `009`/`010`/`011`). É o **`#20` / "07 · Devolução de EPI"**: o
> funcionário devolve EPIs entregues, o estoque é **reposto** (movimento de **retorno**, inverso do
> `employee_delivery` da `011`) e a ficha/histórico reflete a devolução.
> **Entidades**: `epi_delivery_items` (ganha `returned_at`), `stock_movements` (ganha um **novo tipo**
> de movimento) e `epi_stock` (saldo **aumenta**). Cabeçalho em `epi_deliveries`.
> **Operações**: listar itens pendentes de devolução (`returned_at IS NULL`) → registrar devolução →
> **reposição transacional** do saldo + carimbo de `returned_at` → confirmação.
> **Contexto**: Modelo B (tenant = escritório = `orgs.id`); herda padrões de `005`–`011`.
> **Depende de**: `008` (modelo), `010` (padrão transacional de escrita do saldo / `registerStockEntry`
> que **incrementa**), **`011`** (a devolução só existe sobre uma **entrega que deu baixa** — i.e.
> `signature_status != pending`).
> **Atenção**: esta fatia **exige migration** (coluna `returned_at` + valor novo no enum
> `stock_movement_type`) e tem **decisões genuinamente em aberto** (granularidade item × entrega;
> devolução parcial) — ver §13.

---

## 1. Objetivo e posição na arquitetura

Entregar o **registro de devolução de EPI** equivalente ao "Devolução" do ePGR: o gestor (ou o fluxo)
marca que um EPI entregue foi devolvido pelo funcionário; o sistema **gera um movimento de estoque de
retorno** (aumenta `epi_stock.balance`), carimba a devolução no item da entrega (`returned_at`) e a
ficha/histórico do funcionário passa a refletir o item como devolvido.

**É o inverso da `011`.** A `011` (entrega) faz um `employee_delivery` que **decrementa** o saldo
(`applyStockExit`). A devolução faz um movimento de **retorno** que **incrementa** o saldo — a mesma
mecânica transacional da `010`/`011`, com o sinal trocado. Tecnicamente, reusa o coração da `010`:
`SELECT … FOR UPDATE` na linha de `epi_stock` → `INSERT stock_movements` → `UPDATE balance`, numa
única transação `withOrg`, atômica com o carimbo de `returned_at`.

**Posição no roadmap**: card `#20` ("07 · Devolução"), logo após o `#19` (entrega/`011`). É a próxima
fatia da pilha de EPIs: `008 → 009 → 010 → 011 → 012 (esta)`. Diretório de spec sugerido:
`.specs/012-ppe-return-record/`; branch `feature/ppe-return-record`.

## 2. Padrões herdados (obrigatórios — vêm de 005–011)

- **Contrato de retorno**: `ActionResult<T> = {ok:true; data} | {ok:false; error:{code,message,fields?}}`
  (`src/shared/server/result.ts`). Server Actions nunca lançam exceção crua na UI.
- **Gate de papel** (caminho interno): `requireOfficeStaff()` — `owner`/`collaborator` operam;
  `client` → `ForbiddenError`/403. Wrapper `officeAction(op, fn, {audit})`.
- **Isolamento (Modelo B)**: `withOrg(orgId, tx => …)`; tenant de `requireTenantContext()`, **nunca**
  Clerk org / `organization_id` / input. RLS `app_runtime` é backstop.
- **Escrita auditada**: `auditedTenantWrite(orgId, "<evento>", fn)` + `logTenantEvent` sem PII.
  Sugestão: `epi.return.write_rejected` / `epi.return.recorded`.
- **Validação zod ANTES da regra**; mapa de erros em `src/shared/api/rest.ts` (`HTTP_BY_CODE`).
- **Repositório / Actions / REST / UI**: espelhar `stock-movements.ts` (010) e `epi-deliveries.ts`
  (011). Paginação offset (`resolvePageParams`, `Paginated<T>`). UI em `src/app/(protected)/…`,
  primitives em `src/app/(protected)/_ui/{form,list}.tsx`.
- **Reuso direto da `010`/`011`**: o helper `applyStockExit` (extraído na `011`) é o modelo para um
  **`applyStockReturn`** simétrico. `registerStockEntry` (que incrementa em `purchase`) é o molde da
  reposição.

## 3. ⚠️ Reconciliação card × repositório real — LER ANTES DE CODAR

O card usa vocabulário/arquitetura genéricos que **não batem** com o repo (mesma divergência da
`009`/`010`/`011`). Resolver na spec para nascer alinhado.

| O que o card diz                                                      | O que existe de fato                                                                                                                    | Ação                                                                                                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `features/epis/` (actions/schema/queries/components)                  | `src/shared/domains/pgr/`, `src/shared/db/repositories/`, `src/shared/server/actions/pgr/`, `src/app/(protected)/…`, `src/app/api/v1/…` | Usar a estrutura real                                                                                                      |
| `organization_id` (Clerk) como escopo                                 | tenant = `orgs.id` via `requireTenantContext()` + `withOrg`; RLS backstop                                                               | **Nunca** Clerk org / input; sempre tenant da sessão                                                                       |
| Integração em **SQLite em memória**                                   | fatias com RLS/CHECK/transação testam contra **Postgres efêmero** (`INTEGRATION_*`)                                                     | Esta fatia tem transação/CHECK/RLS/migration → **Postgres efêmero**, nunca SQLite (o CLAUDE.md diz: não há caminho SQLite) |
| Movimento "tipo: devolucao"                                           | enum `stock_movement_type` = `purchase \| employee_delivery \| adjustment \| discard` — **NÃO** tem retorno/devolução                   | **Adicionar valor ao enum → migration** (decidir o nome: ver §5)                                                           |
| `returned_at` em `epi_delivery_items`                                 | **coluna NÃO existe** no schema `008`                                                                                                   | **Adicionar coluna → migration** (ver §5)                                                                                  |
| Ref. `.specs/004-epgr-feature-parity/03-epi-estoque.md`               | **não existe** (`004` aqui é `multi-tenant-isolation`)                                                                                  | Corrigir referências; usar `.specs/008-epi-data-model/` + briefings                                                        |
| Ref. `docs/architecture/03-api-design.md`, `02-modelagem-de-dados.md` | diretório `docs/architecture/` **não existe**                                                                                           | Remover/repontuar; o "padrão de Server Action" é `officeAction`/`restHandler` reais                                        |
| "Ver doc 03 para padrão de Server Action"                             | padrão real = `officeAction` + `auditedTenantWrite` + `withOrg`                                                                         | Seguir o padrão do repo                                                                                                    |

## 4. ⚠️ Reconciliação card × modelo real (008) — o que existe e o que FALTA

Schema real hoje (`src/shared/db/schema/epis.ts`, migration `0007`):

```
epi_deliveries:  id, org_id, employee_id, delivery_date, signature_status
                 (pending|signed_qr|signed_link|signed_manual), auth_token, timestamps
epi_delivery_items: id, org_id, delivery_id (→ epi_deliveries CASCADE),
                    catalog_id (→ epi_catalog RESTRICT), quantity (CHECK > 0), timestamps
                    ← NÃO tem returned_at
stock_movements: id, org_id, stock_id (→ epi_stock CASCADE),
                 delivery_id (→ epi_deliveries SET NULL),
                 type (purchase|employee_delivery|adjustment|discard),  ← sem "retorno"
                 quantity (CHECK > 0), movement_date, invoice_number, timestamps
epi_stock: balance (CHECK >= 0), min_quantity (CHECK >= 0), UNIQUE(org_id, catalog_id)
```

**O que FALTA (e por isso esta fatia tem migration — `0008_*`):**

1. **`epi_delivery_items.returned_at`** — `timestamptz NULLABLE` (nulo = pendente de devolução). É a
   marca de devolução por item. Reaproveita o índice/RLS já existentes da tabela.
2. **Novo valor no enum `stock_movement_type`** para o retorno. **Decisão de nome** (enum em inglês
   no banco, como manda a constituição): sugestão **`employee_return`** (simétrico a
   `employee_delivery`). O card escreve "devolucao"/"devolução" — isso é rótulo pt-BR de UI, **não** o
   valor do enum. `ALTER TYPE … ADD VALUE` é a migration.
3. Ajustar a **derivação de saldo** (`signedQuantity`/`computeRunningBalance`/window function da
   `010`) para tratar o novo tipo como **`+`** (hoje só `purchase` soma; todo o resto subtrai — um
   retorno mal classificado **quebraria** o histórico e o saldo acumulado). Ver §6.

> Diferença crítica vs. `009/010/011`: **esta fatia NÃO é zero-migration.** Gerar via drizzle-kit
> (`db:generate`) e completar com SQL custom se necessário (GRANT/trigger não mudam; é só coluna +
> enum). Aplicar pela conexão direta unpooled (owner).

## 5. Modelo de dados proposto

- `epi_delivery_items.returned_at timestamptz` (nullable). `IS NULL` = pendente; preenchido = devolvido.
- `stock_movement_type += 'employee_return'` (rótulo UI pt-BR: "Devolução de funcionário").
- O movimento de retorno guarda `delivery_id` (liga à entrega de origem) e `stock_id` (a linha de
  `epi_stock` a repor), `quantity = item.quantity`, `movement_date = data da devolução`.
- **`epi_stock.balance` aumenta** — sem `CHECK` a violar (incrementa). Sem `InsufficientStockError`.

## 6. Lógica transacional da devolução (helper `applyStockReturn`)

Simétrico ao `applyStockExit` (já extraído na `011` em `stock-movements.ts`). Numa transação `withOrg`:

```
applyStockReturn(tx, { orgId, stockId, quantity, deliveryId, movementDate }):
  SELECT … FOR UPDATE epi_stock (trava a linha)   // serializa concorrência
  newBalance = balance + quantity                 // retorno SOMA (não há limite superior)
  INSERT stock_movements(type='employee_return', stock_id, delivery_id, quantity, movement_date)
  UPDATE epi_stock SET balance = newBalance
  return { movement, newBalance }
```

Server Action de devolução, na **mesma transação**:

1. Carrega a entrega/itens do tenant (`FOR UPDATE` no cabeçalho — serializa devoluções concorrentes).
2. Valida: entrega existe no tenant; **deu baixa** (`signature_status != pending`); item ainda
   `returned_at IS NULL` (senão `ALREADY_RETURNED`); resolve `stock_id` a partir de
   `epi_delivery_items.catalog_id` (= `epi_stock.catalog_id`, igual à `011`).
3. Para cada item devolvido: `applyStockReturn` → repõe saldo + cria `employee_return`.
4. `UPDATE epi_delivery_items SET returned_at = <data>` nos itens devolvidos.
5. Retorna `{ returnedItems, newBalances }`. Rollback total se qualquer passo falhar.

**Consistência do saldo derivado (010)**: atualizar `signedQuantity(type, q)` e o `CASE` da window
function para `employee_return → +q` (hoje `purchase → +`, resto `−`). Sem isso, o histórico por item
mostraria a devolução como saída e o saldo acumulado divergiria do `balance` real.

## 7. Regras de negócio e invariantes

- **Só devolve o que foi entregue de fato**: entrega `pending` (não assinada → não baixou) **não tem
  o que devolver**. Restringir devolução a entregas com `signature_status != pending`.
- **Idempotência/uso único**: item com `returned_at` preenchido não pode ser devolvido de novo
  (`ALREADY_RETURNED`/409). Travar a entrega com `FOR UPDATE` para evitar corrida.
- **Saldo só muda por movimentações**: a reposição é um `stock_movements`; nunca `UPDATE balance`
  avulso. `SUM(signed)` do histórico continua batendo com `balance`.
- **Data de devolução** não pode ser anterior à `delivery_date` (validação de domínio).
- **Isolamento**: tudo escopado pelo tenant da sessão; cross-tenant → `NOT_FOUND`.

## 8. Granularidade: item × entrega + devolução parcial (DECISÃO EM ABERTO)

O card é ambíguo: fala em **`returned_at` por item** (`epi_delivery_items`) **e** em "entrega já
devolvida" (cabeçalho). Opções (resolver no `/speckit-clarify`):

- **A — por item, devolução total do item (recomendado p/ MVP)**: cada `epi_delivery_items` devolve a
  quantidade inteira; `returned_at` carimba o item. "Entrega devolvida" = todos os itens com
  `returned_at`. Simples, casa com o `returned_at IS NULL` do card. Sem coluna de quantidade devolvida.
- **B — por item, devolução parcial (quantidade)**: devolver `n < quantity` exige uma coluna
  `returned_quantity` (mais migration) ou linhas de devolução separadas. Mais flexível, mais complexo.
- **C — por entrega (tudo ou nada)**: devolve a entrega inteira de uma vez; `returned_at` em todos os
  itens. Menos granular.

Recomendação: **A** no MVP (US1), deixando B como evolução. `returned_at` por item já habilita a lista
de pendentes e a reposição correta.

## 9. Erros novos (mapear em `src/shared/api/rest.ts`)

- **`ALREADY_RETURNED` → 409** (`AlreadyReturnedError extends AppError`) — item/entrega já devolvido.
- Possivelmente **`NOT_DELIVERED` → 422** (`InvalidReturnError`) — tentativa de devolver entrega
  `pending` (não assinada) ou data de devolução < data de entrega. (Ou tratar como `VALIDATION`.)
- Reusar `NOT_FOUND → 404` (entrega/item inexistente, cross-tenant) e `FORBIDDEN → 403` (client).
- Espelha o padrão da `011` (`AlreadySignedError`/`TokenExpiredError` → `HTTP_BY_CODE`).

## 10. Camadas a implementar (espelhando 010/011)

- **Domínio** `src/shared/domains/pgr/epi-returns.ts`: `returnCreateSchema` (entrega + itens a
  devolver + `returnDate`); validação `returnDate >= deliveryDate`; rótulo pt-BR do novo tipo; DTOs
  (`PendingReturnItem`, `ReturnResult`).
- **Repo** `src/shared/db/repositories/epi-returns.ts` (ou estender `epi-deliveries.ts`):
  `listPendingReturns(orgId, { employeeId?, search, page })` (filtra `returned_at IS NULL`),
  `recordReturn(orgId, input)` (transação descrita em §6). + `applyStockReturn` em `stock-movements.ts`.
- **Actions** `src/shared/server/actions/pgr/epi-returns.ts`: `recordReturnAction`,
  `listPendingReturnsAction` via `officeAction(..., {audit})` + `revalidatePath`.
- **REST** `src/app/api/v1/epi-returns/` (ou `/api/v1/epi-deliveries/[id]/return`): `POST` devolver,
  `GET` pendentes.
- **UI**: lista de pendentes (por funcionário e/ou global) + ação de devolver (modal espelhando
  `register-exit.tsx`) com confirmação; refletir na ficha/histórico do funcionário (a página do
  funcionário hoje tem placeholders "EPIs/Histórico" — esta fatia pode preencher a parte de EPIs).

## 11. Edge cases (do card + derivados)

- Devolver EPI **já devolvido** → `ALREADY_RETURNED`/409 (backend) + feedback na UI.
- **Data de devolução anterior à entrega** → `VALIDATION`.
- Devolver item de **entrega não assinada/pendente** → `NOT_DELIVERED` (nada baixado a repor).
- **Funcionário/entrega de outra organização** → `NOT_FOUND` (isolamento).
- Devolução concorrente do mesmo item (corrida) → serializado por `FOR UPDATE`; segundo → 409.
- Entrega/estoque/catálogo deletado entre entrega e devolução (`stock_id` resolvido de `catalog_id`
  inexistente) → tratar como `NOT_FOUND`/erro claro (a `epi_delivery_items.catalog_id` é RESTRICT).

## 12. Testes (obrigatórios — Postgres efêmero, nunca SQLite)

- **Unit** (`epi-returns` domínio): `returnCreateSchema` (itens, `returnDate >= deliveryDate`),
  rótulo do tipo, `signedQuantity('employee_return')` = `+`.
- **Integração** (Server Actions/repo, `INTEGRATION_*`): devolução repõe saldo + cria 1
  `employee_return`/item (com `delivery_id`) + carimba `returned_at`; **já devolvido → 409**;
  pendentes filtra `returned_at IS NULL` e some após devolver; entrega `pending` → recusa;
  data inválida → 422; **isolamento cross-tenant** (não devolve/repõe item de outra org); rollback.
- **Migration shape**: a `epi-migration-shape`/`epi-constraints` deve cobrir a nova coluna + enum.
- `npm run test` + `npm run test:integration` verdes.

## 13. Decisões genuinamente em aberto (levar ao /speckit-clarify)

1. **Granularidade/parcial** (§8): A (item total, recomendado) × B (parcial c/ quantidade) × C (entrega).
2. **Nome do valor do enum**: `employee_return` (recomendado) × outro. (Rótulo pt-BR é "Devolução".)
3. **Só entregas assinadas podem ser devolvidas?** (recomendado **sim** — pending não baixou).
4. **Reabrir o token/assinatura?** Não — devolução é evento separado; não mexe em `signature_status`.
5. **Escopo da "ficha/histórico do funcionário"**: criar uma visão de EPIs por funcionário nesta fatia
   ou só registrar e exibir no histórico de estoque já existente (010)?

## 14. Dependências e riscos

- **Depende da `011`** (entrega): sem entrega assinada não há item a devolver. A `011` está com
  **MVP parcial** (só US1/assinatura manual) — suficiente para a devolução, pois o que importa é a
  entrega ter baixado o estoque (`signature_status != pending`).
- **Risco da migration**: é a 1ª fatia de fluxo com migration desde a `008`. `ALTER TYPE … ADD VALUE`
  não roda dentro de transação em algumas versões do Postgres — validar a estratégia do drizzle-kit /
  splitter de `--> statement-breakpoint` do helper de testes.
- **Risco de regressão no saldo derivado (010)**: mexer em `signedQuantity`/window function afeta o
  histórico de **todos** os tipos — cobrir com teste para não quebrar a `010`.

## 15. Fatiamento sugerido (MVP primeiro)

- **MVP (US1)**: migration + domínio + `applyStockReturn` + `recordReturn` + `listPendingReturns` +
  action/REST + UI mínima (lista de pendentes + devolver + confirmação) + testes. **Granularidade A**.
- **Incrementos**: devolução parcial (B); visão rica de EPIs na ficha do funcionário; devolução em
  lote.

## 16. Checklist de tarefas (mapeado ao card)

- [ ] **Migration `0009`**: `epi_delivery_items.returned_at` + `stock_movement_type += employee_return`.
- [ ] **Dados**: schema zod `returnCreateSchema` (itens + `returnDate`, `returnDate >= deliveryDate`).
- [ ] **Backend**: `applyStockReturn` (helper) + `recordReturn` (transação: `returned_at` + movimento).
- [ ] **Backend**: `listPendingReturns` (filtro `returned_at IS NULL`, escopado por org/funcionário).
- [ ] **Backend**: ajustar `signedQuantity`/window function p/ `employee_return → +`.
- [ ] **Frontend**: fluxo de devolução (modal/página) + lista de pendentes + confirmação.
- [ ] **Regra**: impedir devolução de item já devolvido (backend 409 + UI).
- [ ] **Multi-tenant**: tudo via `withOrg`/tenant da sessão.
- [ ] **Erros**: `ALREADY_RETURNED`/409 (+ `NOT_DELIVERED`?) no `HTTP_BY_CODE`.
- [ ] **Testes**: unit + integração (Postgres efêmero) + isolamento cross-tenant.
- [ ] **Qualidade**: `lint` + `tsc --noEmit` + `test`/`test:integration` verdes.

## 17. Template `/speckit-specify` corrigido (alinhado ao repo)

```
/speckit-specify

GIT_BRANCH_NAME: feature/ppe-return-record

Feature: PPE return record (devolução de EPI)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa (Modelo B: tenant = escritório = orgs.id).
Fatia 012 da pilha de EPIs (008→009→010→011→012). 1 issue = 1 branch = 1 spec.
Antes de escrever a spec, leia: este briefing, .specs/008-epi-data-model/ (modelo),
.specs/010-stock-movements/ (padrão transacional) e .specs/011-ppe-delivery-with-signature/
(entrega/baixa que a devolução inverte). Liste os arquivos que vai ler.
ATENÇÃO: esta fatia EXIGE migration (coluna returned_at + valor novo no enum
stock_movement_type) — NÃO é zero-migration. Tenant SEMPRE da sessão (nunca Clerk org/input).
Testes de integração contra Postgres efêmero (INTEGRATION_*), NUNCA SQLite.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero registrar a devolução de EPIs de uma entrega para que o
  saldo em estoque seja reposto automaticamente e a ficha do funcionário fique atualizada.
- (P2) Como gestor, quero ver a lista de EPIs pendentes de devolução.

Success criteria mensuráveis (tecnologia-agnósticos):
- A lista de pendentes nunca mostra um item já devolvido.
- O saldo em estoque aumenta automaticamente após a devolução.
- Uma entrega já devolvida não pode ser devolvida de novo (erro claro).

Edge cases a considerar:
- Devolução de um EPI já devolvido.
- Data de devolução anterior à data de entrega.
- Devolução de entrega ainda não assinada (que não deu baixa).
- Funcionário/entrega de outra organização.

Restrições obrigatórias (constituição):
- Todo acesso a dados escopado pelo tenant da sessão (requireTenantContext + withOrg; RLS backstop).
- Validação de schema (Zod) ANTES da regra em toda Server Action/handler.
- Saldo só muda por movimentação; reposição via stock_movements, nunca UPDATE balance avulso.

NÃO invente solução técnica detalhada aqui — só o "o quê" e o "porquê".
Spec em português brasileiro; branch e commits em inglês.
```

---

> **Resumo executivo**: a Devolução é o **espelho da entrega (`011`)** — incrementa o saldo via um
> novo movimento `employee_return` e carimba `returned_at` no item. O diferencial desta fatia é que
> ela **quebra o "zero migration"** (coluna + enum novos) e força um ajuste cuidadoso na derivação de
> saldo da `010`. As maiores decisões em aberto são **granularidade (item × parcial × entrega)** e
> **restringir a devolução a entregas assinadas**. Recomenda-se MVP com granularidade por item (total).

## 18. Prompt DETALHADO para `/speckit-specify` (todo o detalhamento — formato do exemplo)

> Mesmo conteúdo do briefing **remontado no esqueleto do exemplo** (`GIT_BRANCH_NAME` + `Feature` +
> `CONTEXTO` + `User stories` P1/P2 + `Success criteria` + `Edge cases`), com todo o detalhamento
> embutido no bloco `CONTEXTO`. Copie do `/speckit-specify` até o fim. Conteúdo da spec em pt-BR;
> branch e commits em inglês.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/ppe-return-record

Feature: PPE return record (devolução de EPI ao estoque)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria
(1 issue = 1 branch = 1 spec). É o card "#20" / "07 · Devolução de EPI". Entrega o REGISTRO de
DEVOLUÇÃO de EPIs que foram entregues a um funcionário (fatia 011/#19): ao devolver, o sistema gera
um movimento de estoque de RETORNO que AUMENTA o saldo do item e marca o item da entrega como
devolvido (returned_at), refletindo na ficha/histórico do funcionário. É o INVERSO da entrega (011):
a entrega faz employee_delivery (-saldo); a devolução faz employee_return (+saldo). Camada de FLUXO
sobre a fundação 008, reutilizando o transacional da 010/011 (SELECT ... FOR UPDATE + INSERT
stock_movements + UPDATE balance).
ATENÇÃO — esta fatia NÃO é zero-migration (ao contrário da 009/010/011): exige migration para uma
COLUNA nova (epi_delivery_items.returned_at) e um VALOR novo no enum stock_movement_type
(employee_return). Gerar via drizzle-kit (db:generate); aplicar pela conexão direta unpooled (owner).

RECONCILIAÇÃO CARD × REPO (o card usa termos genéricos que NÃO batem — resolver na spec):
- "features/epis/" NÃO existe -> usar src/shared/domains/pgr/, src/shared/db/repositories/,
  src/shared/server/actions/pgr/, src/app/(protected)/..., src/app/api/v1/...
- "organization_id (Clerk)" como escopo -> tenant = orgs.id via requireTenantContext() + withOrg();
  RLS app_runtime backstop. NUNCA Clerk org / organization_id / input do cliente.
- "SQLite em memória" -> integração contra Postgres EFÊMERO (INTEGRATION_*); NÃO há caminho SQLite.
- "tipo: devolucao" é só rótulo pt-BR -> o VALOR do enum (inglês) é employee_return.
- Refs .specs/004-epgr-feature-parity/03-epi-estoque.md e docs/architecture/* NÃO existem -> usar
  este briefing (docs/briefings/briefing-ppe-return-record.md) e .specs/008-epi-data-model/.

ANTES DE ESCREVER A SPEC, leia e liste (dizendo o que extraiu de cada):
- src/shared/db/schema/epis.ts (epi_deliveries, epi_delivery_items, stock_movements, epi_stock; enum stock_movement_type)
- src/shared/db/repositories/stock-movements.ts (applyStockExit/applyStockReturn, registerStockEntry, window function do saldo)
- src/shared/db/repositories/epi-deliveries.ts (createDelivery, signDeliveryManual — a entrega que DEU BAIXA e que será devolvida)
- src/shared/domains/pgr/stock-movements.ts (signedQuantity, TYPE_LABELS) e epi-deliveries.ts (DTO NewBalance)
- src/shared/server/office-action.ts, result.ts, action-error.ts; src/shared/api/rest.ts (HTTP_BY_CODE)
- src/shared/db/with-org.ts (transação + set_config app.current_org)
- src/app/(protected)/_ui/{form,list}.tsx; src/app/(protected)/epi-stock/_components/register-exit.tsx (modal padrão)
- src/__tests__/integration/pgr/epi-deliveries.test.ts e _helpers/{db,pgr-seed}.ts (padrão de teste + seed)
- docs/briefings/briefing-ppe-return-record.md; .specs/008-epi-data-model/

MODELO (008) — o que existe e o que a migration ADICIONA:
- epi_deliveries: id, org_id, employee_id, delivery_date (DATE), signature_status
  (pending|signed_qr|signed_link|signed_manual), auth_token, timestamps.
- epi_delivery_items: id, org_id, delivery_id (->epi_deliveries CASCADE), catalog_id (->epi_catalog RESTRICT) <- GUARDA CATALOG_ID,
  quantity (CHECK > 0). MIGRATION ADICIONA: returned_at (timestamptz NULLABLE; NULL = pendente, preenchido = devolvido).
- stock_movements: type (enum) + delivery_id (->epi_deliveries SET NULL); quantity CHECK > 0; movement_date DATE.
  MIGRATION ADICIONA o valor employee_return ao enum stock_movement_type.
- epi_stock: balance (CHECK >= 0) saldo MATERIALIZADO; min_quantity; UNIQUE(org_id, catalog_id).
CONSISTÊNCIA DO SALDO DERIVADO (010): hoje só 'purchase' soma; todo o resto subtrai. employee_return
DEVE somar (+). Ajustar signedQuantity (domínio) E o CASE da window function (repositório) para
('purchase','employee_return') -> +, sob pena de quebrar o histórico/saldo de TODOS os tipos (cobrir com teste).

REGRAS NÃO-NEGOCIÁVEIS (constituição / Modelo B):
- Tenant = orgs.id via requireTenantContext() + withOrg(); requireOfficeStaff() (owner/collaborator; client -> 403).
  NUNCA Clerk org / organization_id / input. RLS backstop. Zod antes da regra; ActionResult<T>; escrita auditada
  (auditedTenantWrite + logTenantEvent sem PII; evento epi.return.write_rejected).
- Saldo só muda por movimentação (stock_movements); NUNCA UPDATE balance avulso.

LÓGICA CENTRAL (transação atômica, inverso da entrega):
- recordReturn(orgId, { deliveryId, returnDate, itemIds }): trava a entrega (SELECT ... FOR UPDATE — serializa
  devoluções concorrentes); valida que está ASSINADA (signature_status != pending; senão VALIDATION/422 "nada a
  devolver") e que returnDate NÃO é anterior a delivery_date (senão VALIDATION/422); carrega os itens pedidos
  (NOT_FOUND/404 se algum não pertence à entrega/tenant; ALREADY_RETURNED/409 se algum já tem returned_at);
  por item resolve a linha de epi_stock pelo catalog_id e chama applyStockReturn (SELECT ... FOR UPDATE -> balance +=
  quantity -> INSERT stock_movements employee_return com delivery_id e movement_date=returnDate); por fim
  UPDATE epi_delivery_items.returned_at. ROLLBACK TOTAL se qualquer passo falhar.
- listPendingReturns(orgId, { employeeId?, search?, page }): itens com returned_at IS NULL em entregas ASSINADAS
  (signature_status != pending — só o que deu baixa pode ser devolvido); busca por nome/CA; paginação offset.

OPERAÇÕES (repo + actions + REST, espelhando epi-deliveries/stock-movements):
- domínio epi-returns: returnCreateSchema (deliveryId uuid; returnDate YYYY-MM-DD; itemIds não-vazio de uuid, sem
  repetidos); isReturnDateBeforeDelivery (puro). actions recordReturnAction/listPendingReturnsAction via officeAction.
  REST GET/POST /api/v1/epi-returns. UI: página /epi-returns (lista de pendentes + busca) com ação "Devolver"
  (confirmação em 2 cliques; ao concluir, o item some da lista) + link no nav. CONFIRMAÇÃO após registrar.

ERROS (mapear no HTTP_BY_CODE de src/shared/api/rest.ts):
- ALREADY_RETURNED -> 409 (item/entrega já devolvido). Reusar VALIDATION -> 422 (entrega não assinada;
  returnDate < deliveryDate). NOT_FOUND -> 404 (entrega/item inexistente, cross-tenant). FORBIDDEN -> 403 (client).

DECISÕES TRAVADAS: estrutura/Modelo B/erros acima; granularidade POR ITEM com devolução TOTAL do item
(returned_at por item; sem coluna de quantidade devolvida); SÓ entregas assinadas podem ser devolvidas;
enum employee_return; reuso do transacional da 010/011 (helper applyStockReturn); enums em inglês, rótulos pt-BR no DTO/UI.
DECISÕES A CLARIFICAR (/speckit-clarify): devolução PARCIAL por quantidade (exigiria coluna returned_quantity — fora do MVP?)
vs total; escopo da "ficha/histórico do funcionário" (criar visão de EPIs por funcionário agora vs só refletir no histórico
de estoque da 010); devolução em LOTE (vários itens/entrega de uma vez) no MVP ou incremento.
FORA DE ESCOPO: devolução parcial por quantidade; rota pública/sem login (devolução é ação interna do gestor);
disparo de e-mail/SMS; alterar a 011 (assinatura permanece; devolução é evento separado, não mexe em signature_status).
TESTES (quality gate; Postgres EFÊMERO via INTEGRATION_*, NUNCA SQLite nem banco de dev): unit (returnCreateSchema;
isReturnDateBeforeDelivery; signedQuantity('employee_return') = +; rótulo); integração (devolução repõe saldo + 1
employee_return/item com delivery_id + carimba returned_at; já devolvido -> 409; entrega pendente -> 422; data anterior
-> 422; item de outra entrega/tenant -> 404; pendentes filtra returned_at IS NULL e some após devolver; isolamento
cross-tenant). migration-shape cobre a coluna + enum. npm run test, npm run test:integration, lint e tsc --noEmit verdes.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero registrar a devolução de EPIs de uma entrega assinada, para que o saldo do
  estoque seja reposto automaticamente e o item fique marcado como devolvido na ficha do funcionário.
- (P2) Como gestor, quero ver a lista de EPIs entregues e ainda não devolvidos (pendentes), para acompanhar e agir.

Success criteria (mensuráveis, tecnologia-agnósticos):
- O saldo do item aumenta automaticamente ao registrar a devolução (exatamente +quantidade devolvida).
- A lista de pendentes NUNCA mostra um item já devolvido, e some imediatamente após a devolução.
- Uma entrega/item já devolvido não pode ser devolvido de novo (erro claro, sem dupla reposição).
- Só itens de entregas ASSINADAS aparecem como pendentes de devolução.
- Toda devolução gera exatamente 1 movimento employee_return por item, vinculado à entrega de origem.

Edge cases:
- Devolver um EPI já devolvido -> 409 (sem alterar saldo).
- Data de devolução anterior à data de entrega -> 422.
- Devolver item de entrega ainda PENDENTE (não assinada, não deu baixa) -> 422 (nada a devolver).
- Funcionário/entrega de outra organização -> 404 (isolamento; não repõe item de outra org).
- Concorrência: duas devoluções da mesma entrega/item (FOR UPDATE serializa; a segunda -> 409).
- itemIds com repetidos no payload (rejeitar na validação). returned_at é timestamptz; movement_date é DATE.

Conteúdo da spec em pt-BR; branch e commits em inglês. NÃO invente solução técnica não descrita aqui —
descreva o "o quê" e o "porquê". A migration é necessária (returned_at + employee_return); marque
claramente as DECISÕES A CLARIFICAR para o /speckit-clarify.
```
