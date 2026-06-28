# Briefing — CRUD do Estoque de EPI (`epi_stock`)

> **Tipo de fatia**: CRUD (UI App Router + Server Actions) sobre um modelo já existente —
> análoga à `007` (CRUD do PGR sobre o modelo da `006`).
> **Entidade**: `epi_stock` (registro de estoque por item de catálogo).
> **Operações**: listar · detalhar · criar (associar item) · editar (mínima) · excluir.
> **Contexto**: Modelo B (tenant = escritório = `orgs.id`); herda padrões de `005`/`006`/`007`.
> **Depende do modelo**: o card cita a issue **#17** (modelo de dados). **Esse modelo já existe
> no repo — é a fatia `008` (`epi_stock` em `src/shared/db/schema/epis.ts`, migrations
> `0007`/`0008`).** Ver §3 (reconciliação) — há divergências de nomes a resolver.

---

## 1. Objetivo e posição na arquitetura

Entregar o **CRUD completo do registro de estoque de EPI**: associar um item do catálogo
(`epi_catalog`) a um estoque, definir/editar a **quantidade mínima**, listar com **status
derivado** (sem saldo / abaixo da mínima / acima da mínima) e excluir. É a primeira fatia de
**fluxo/CRUD do módulo de EPIs** (Fase 2) sobre a fundação de dados da `008`.

Paralelo direto: a **`007`** (`.specs/007-pgr-base-cruds/`), que fez CRUD das 5 entidades do PGR
sobre o modelo da `006`. Esta fatia replica **exatamente** aquele padrão (contrato `Result`,
autorização por papel, `withOrg`, repositório, paginação) — agora para `epi_stock`.

**Regra de ouro desta fatia**: o **saldo (`balance`/`current_balance`) é SOMENTE LEITURA**. Ele
só muda por **movimentações (#72)**. Aqui o CRUD escreve apenas o **vínculo do item** e a
**quantidade mínima**. O **status é DERIVADO** (calculado em leitura), sem coluna nem trigger.

## 2. Padrões herdados (obrigatórios — vêm de 005/006/007)

- **Contrato de retorno**: `ActionResult<T> = {ok:true; data} | {ok:false; error:{code,message,fields?}}`
  em `src/shared/server/result.ts` (helpers `ok()`/`fail()`). Server Actions **nunca** lançam exceção crua na UI.
- **Autorização por papel**: `requireOfficeStaff()` sobre `requireTenantContext().role` —
  `owner`/`collaborator` operam; papel `client` → `ForbiddenError`/403. (FR-065 da `007`.)
- **Isolamento (Modelo B)**: todo acesso via `withOrg(orgId, tx => …)`; tenant ativo de
  `requireTenantContext()`, **nunca** Clerk org / `organization_id` / input do cliente. RLS
  `app_runtime` (`current_setting('app.current_org', true)`) é **backstop**.
- **Escrita auditada**: `auditedTenantWrite(orgId, "<evento>", fn)` envolve create/update/delete
  (ver `companies.ts`/`ges.ts`); `logTenantEvent` sem PII (`requestId/orgId/userId/operation`).
- **Paginação offset**: `resolvePageParams` + `Paginated<T> = {rows, total}` (`src/shared/pagination`).
- **Derivação em leitura via SQL**: a `006`/`007` já derivam "nº de expostos" por agregação no
  SQL (`ges.ts` → `coalesce(sum(...))`). O **status do estoque** segue a mesma filosofia: `CASE`
  no `SELECT`, sem coluna.
- **Camadas REST + Actions**: a cadeia do PGR expõe **Server Actions** (UI) **e** Route Handlers
  REST em `src/app/api/v1/<recurso>/` (ex.: `companies`, `ges`). Ver §9 (decisão: incluir
  `/api/v1/epi-stock` ou só Server Actions).
- **Repositório**: `src/shared/db/repositories/epi-stock.ts` (módulo EPIs), espelhando
  `companies.ts`/`ges.ts`.

## 3. ⚠️ Reconciliação card × modelo real (008) — RESOLVER ANTES DE CODAR

O card foi escrito assumindo um modelo a ser criado por "#17". **Esse modelo já existe (fatia 008)** e tem **nomes diferentes** dos citados no card. É o ponto mais importante deste briefing.

| O que o card diz                   | O que existe de fato (`epis.ts`, migration `0007`)                                                                                                    | Ação                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `current_balance`                  | **`balance`** (`integer NOT NULL DEFAULT 0`)                                                                                                          | Usar `balance`; expor como `currentBalance` no DTO se quiser manter o vocabulário do ePGR |
| `minimum_quantity`                 | **`min_quantity`** (`integer NOT NULL DEFAULT 0`)                                                                                                     | Usar `min_quantity`; DTO `minimumQuantity`                                                |
| join em `epi_categories`           | **não existe `epi_categories`**; reuso de **`categories`** (decisão da 008)                                                                           | Join em `epi_catalog → categories`                                                        |
| FK/UNIQUE/ON DELETE "conforme #17" | **`UNIQUE(org_id, catalog_id)`** (`uq_epi_stock_org_catalog`); `catalog_id → epi_catalog ON DELETE CASCADE`; `CHECK balance ≥ 0` e `min_quantity ≥ 0` | Já definidos — usar como estão                                                            |
| issue de modelo **#17**            | corresponde à **fatia `008`** (já implementada e migrada)                                                                                             | Tratar `008` como o modelo-base                                                           |

**Decisão recomendada de vocabulário**: manter os **nomes do banco** (`balance`, `min_quantity`)
no schema/SQL e, **se** o produto exigir o rótulo ePGR, mapear nos **DTOs** (`currentBalance`,
`minimumQuantity`) — sem renomear colunas (evita migration desnecessária). Confirmar com o dono.

### 3.1 Coluna "Empresa" da listagem — **gap de modelo**

O card pede a coluna **Empresa** no list. Mas `epi_catalog` **não tem vínculo com empresa**
(`company_id`): a cadeia é `epi_catalog → categories` (taxonomia), e `categories` também não tem
empresa. **Não há origem para "Empresa" no modelo atual.** Opções: (a) **remover** a coluna
Empresa desta fatia; (b) adicionar `company_id` a `epi_catalog` (muda o modelo 008 — fora do
escopo de um CRUD); (c) derivar de outra relação a definir. **Recomendação: (a) remover Empresa**
do list nesta fatia e registrar como item futuro. **Bloqueador a confirmar.**

## 4. Status derivado (regra central) — sem coluna, sem trigger

Calculado em leitura por comparação `balance` × `min_quantity`:

| Status          | Regra                                     |
| --------------- | ----------------------------------------- |
| `sem_saldo`     | `balance = 0`                             |
| `abaixo_minima` | `balance > 0 AND balance < min_quantity`  |
| `acima_minima`  | `balance >= min_quantity AND balance > 0` |

- **Edge mínima = 0**: nunca gera `abaixo_minima` (pois `balance ≥ 0 = min`); com `balance = 0`
  vira `sem_saldo`. Ou seja, mínima 0 ⇒ **sem alerta**.
- **No SQL** (list): `CASE WHEN balance = 0 THEN 'sem_saldo' WHEN balance < min_quantity THEN
'abaixo_minima' ELSE 'acima_minima' END`.
- **Em unit test**: extrair uma função pura `deriveStockStatus(balance, min)` (testável sem
  banco) e reusá-la no DTO; o `CASE` no SQL é o espelho dela para filtro/ordenação.
- **Alerta visual** (UI): badge quando `abaixo_minima` (e opcionalmente `sem_saldo`).

## 5. Operações do CRUD (repositório/Server Actions)

Todas org-scopadas (`requireTenantContext()` → `requireOfficeStaff()` → `withOrg`). Padrão
idêntico a `companies.ts`/`ges.ts`.

| Operação      | Assinatura (repo)                                                        | Comportamento                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Listar**    | `listEpiStock(orgId, {search, withBalanceOnly, status, page, pageSize})` | `SELECT` com `join epi_catalog` (+ `categories`); status derivado por `CASE`; filtros "apenas com saldo" (`balance > 0`) e status; busca `ilike` por nome/CA; `Paginated<T>`; sem tenant → vazio.                                     |
| **Detalhar**  | `getEpiStockById(orgId, id)`                                             | 1 registro do tenant (join catálogo + status); inexistente/outro tenant → `null` → **404** na action.                                                                                                                                 |
| **Criar**     | `createEpiStock(orgId, input)`                                           | zod (`catalog_id` uuid, `minQuantity ≥ 0`); insere `{orgId, catalogId, minQuantity}`; **não escreve `balance`** (default 0); `UNIQUE(org, catalog)` violado → **409**; `catalog_id` inexistente (FK) → **422**; `auditedTenantWrite`. |
| **Atualizar** | `updateEpiStock(orgId, id, patch)`                                       | zod parcial; **edita só `min_quantity`**; **`balance` nunca no `set`**; `updated_at` via trigger; inexistente/outro tenant → **404**; auditado.                                                                                       |
| **Excluir**   | `deleteEpiStock(orgId, id)`                                              | remove no tenant; **`stock_movements` descem em CASCADE** (ver §6) — UI confirma e avisa que o histórico de movimentações some; 404 cross-tenant; auditado.                                                                           |
| _(aux)_       | `countEpiStockDependents(orgId, id)`                                     | conta `stock_movements` para o aviso de exclusão (padrão `countCompanyDependents`).                                                                                                                                                   |

## 6. Exclusão — atenção ao `ON DELETE` real (008)

No modelo `008`, `stock_movements.stock_id → epi_stock` é **`ON DELETE CASCADE`**. Logo, **excluir
um estoque apaga as movimentações dele** (histórico perdido silenciosamente). O card pede
"aviso/bloqueio coerente se houver movimentações". A `007` adota **confirmar-com-aviso** (conta
dependentes e mostra antes; sem bloquear). **Recomendação**: seguir o padrão `007` — usar
`countEpiStockDependents` para **avisar** "este estoque tem N movimentações que serão excluídas",
e deixar a CASCADE do banco agir. Se o produto exigir **bloqueio**, isso muda o modelo (trocar
para `RESTRICT` na `008`) — fora do escopo deste CRUD; registrar como decisão. (Entregas/itens de
entrega referenciam `epi_catalog`, **não** `epi_stock`, então não bloqueiam a exclusão do estoque.)

## 7. Validação, erros e auditoria

- **zod** antes de qualquer regra: `epiStockCreateSchema` (`catalogId` uuid, `minQuantity` int ≥ 0)
  e `epiStockUpdateSchema` (parcial — na prática só `minQuantity`). Em `src/shared/domains/pgr/`
  (módulo EPIs).
- **Erros padronizados** via `AppError`/`toActionError` → HTTP. **Atenção à convenção do repo**
  (`src/shared/api/rest.ts`): `VALIDATION → 422`, `DUPLICATE → 409`, `FK_NOT_FOUND → 422`,
  `NOT_FOUND → 404`, `FORBIDDEN → 403`. ⚠️ O card cita "validação → **400**", mas o **padrão
  vigente do projeto é 422** para zod. **Recomendação: seguir o projeto (422)**, não o 400 do card.
- **Auditoria**: `auditedTenantWrite` + `logTenantEvent` em create/update/delete (sem PII).

## 8. Testes (obrigatórios — quality gate)

- **Unit**: `deriveStockStatus(balance, min)` cobrindo `sem_saldo`/`abaixo_minima`/`acima_minima`
  e o edge `min = 0`; schemas zod (create/update; `minQuantity ≥ 0`).
- **Integração (Server Actions / repo)**: `list` (paginação/filtros/busca), `getById`, `create`,
  `update`, `delete`; **404 cross-tenant** em `getById`/`update`/`delete`; **409** ao associar item
  já no estoque (UNIQUE); **`balance` inalterado** por `create`/`update`; filtros corretos.
- **Isolamento multi-tenant em Postgres efêmero** (`INTEGRATION_*`/`runIsolationSuite`, **nunca
  SQLite**) — `epi_stock` já tem suíte de isolamento na `008`; aqui o foco é o comportamento das
  actions.
- `npm run test` e `npm run test:integration` verdes; `npm run lint` + tipos verdes.

## 9. Decisões em aberto / riscos (resolver antes de codar)

1. **Nomes `balance`/`min_quantity` × `current_balance`/`minimum_quantity`** (§3) — recomendado
   manter colunas e mapear no DTO. **Confirmar.**
2. **Coluna "Empresa" no list** (§3.1) — sem origem no modelo. **Recomendado remover** desta fatia.
3. **Exclusão: avisar vs bloquear** (§6) — CASCADE real apaga movimentações; recomendado
   avisar (padrão `007`). Bloqueio exigiria mudar a `008`.
4. **REST `/api/v1/epi-stock`?** — a cadeia do PGR tem Route Handlers REST além das Server Actions.
   Decidir se esta fatia inclui `/api/v1/epi-stock` (consistência + testável no Postman) ou só
   Server Actions/UI. **Recomendado incluir** (alinha com o que já existe e com o teste manual).
5. **Status HTTP de validação: 422 (projeto) × 400 (card)** (§7) — seguir o projeto (422).

## 10. Fora de escopo (explícito)

- **Movimentações** de estoque (entrada/saída/histórico) que alteram `balance` → **#72**.
- Baixa por **entrega** de EPI → **#19**; reposição por **devolução** → **#20**.
- **CRUD do catálogo** (itens em si) → **#18**.
- Qualquer alteração do **modelo `008`** (renomear colunas, adicionar `company_id`, trocar
  ON DELETE) — só se uma decisão acima exigir, em fatia/migração própria.

## 11. Critérios de aceite (do card)

- [ ] **5 operações** implementadas e testadas: `list` (paginada/filtros/busca), `getById` (404
      cross-tenant), `create` (associar item), `update` (404 cross-tenant; só mínima), `delete`
      (confirmação).
- [ ] **Status derivado** (Sem Saldo / Abaixo da Mínima / Acima da Mínima) do saldo vs. mínima,
      sem coluna.
- [ ] Filtro "Apenas com saldo" e filtro de status funcionam.
- [ ] Busca por nome / CA (e Empresa **somente se** resolvido o §3.1).
- [ ] Alerta visual quando `balance < min_quantity`.
- [ ] `balance` **não editável** neste CRUD (só via #72).
- [ ] Estoque de outro escritório **nunca** aparece nem é acessível (RLS backstop / 404).
- [ ] `npm run test` e `npm run test:integration` (incl. isolamento em Postgres efêmero) verdes.

## 12. Referências

- Modelo-base (o "#17" do card): **fatia `008`** — `.specs/008-epi-data-model/`,
  `src/shared/db/schema/epis.ts`, migrations `0007`/`0008`.
- Padrão de CRUD: **`007`** — `.specs/007-pgr-base-cruds/`; `src/shared/server/result.ts`;
  `src/shared/db/repositories/{companies,ges}.ts`; `src/app/api/v1/*`.
- Modelo/isolamento: `.specs/006-cadastros-base-pgr/`, `.specs/005-modelo-tenant-gate-pro/`,
  `.specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md`.
- Movimentações (saldo): **#72**. Constituição v1.2.1 — Princípios I (Modelo B) e V (integridade).

---

## 13. Prompt para `/speckit-specify`

> Copie o bloco abaixo (começa em `/speckit-specify`) e rode. Já incorpora as reconciliações do
> §3 (nomes reais do modelo `008`, reuso de `categories`, "#17" = fatia `008`) para a spec nascer
> alinhada ao que existe no repo.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/epi-stock-crud

Feature: CRUD do estoque de EPI (epi_stock)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria
(1 issue = 1 branch = 1 spec), análoga à 007 (CRUD do PGR sobre o modelo da 006). Esta fatia é a
UI (App Router) + Server Actions de CRUD do REGISTRO de estoque: list, getById, create (associar
item do catálogo ao estoque), update (definir/editar a quantidade mínima), delete.

IMPORTANTE — o modelo já existe: o card cita a issue de modelo "#17", que no repositório
corresponde à fatia 008 (.specs/008-epi-data-model/). A tabela epi_stock JÁ existe em
src/shared/db/schema/epis.ts (migrations 0007/0008) com estas colunas REAIS:
- balance (integer, saldo atual, default 0) — o "current_balance" do ePGR;
- min_quantity (integer, default 0) — a "quantidade mínima";
- catalog_id (FK -> epi_catalog ON DELETE CASCADE); org_id (tenant); UNIQUE(org_id, catalog_id);
  CHECK balance >= 0 e min_quantity >= 0; timestamps + trigger set_updated_at.
A taxonomia é a tabela `categories` (NÃO existe epi_categories). Leia .specs/008-*, .specs/007-*,
.specs/006-* e os repositórios companies.ts/ges.ts antes de escrever a spec. Liste os arquivos
que vai ler.

REGRAS (constituição / Modelo B):
- Tenant ativo = escritório = orgs.id via requireTenantContext() + withOrg(); nunca Clerk org,
  organization_id nem input do cliente. RLS app_runtime é backstop.
- Autorização por papel: requireOfficeStaff() (owner/collaborator operam; client -> 403).
- Server Actions validam com zod e retornam ActionResult<T> (ok/fail); auditoria via
  auditedTenantWrite/logTenantEvent sem PII.
- O SALDO (balance) é SOMENTE LEITURA neste CRUD — alterado apenas por movimentações (#72).
  Nunca aparece em create/update.
- O STATUS é DERIVADO (sem_saldo / abaixo_minima / acima_minima) por comparação balance x
  min_quantity, sem coluna e sem trigger (CASE no SQL na listagem; função pura no unit test).

ENTIDADE E DERIVAÇÃO:
- Registro de estoque = (catalog_id, min_quantity) por tenant; balance read-only.
- Status: sem_saldo (balance=0) / abaixo_minima (0<balance<min) / acima_minima (balance>=min e
  >0); mínima=0 nunca gera alerta.

OPERAÇÕES (repositório src/shared/db/repositories/epi-stock.ts + Server Actions):
- listEpiStock: paginada/ordenada do tenant; join epi_catalog (+ categories); status derivado por
  CASE; filtros "apenas com saldo" (balance>0) e status; busca por nome/CA; sem tenant -> vazio.
- getEpiStockById: 1 registro do tenant; inexistente/outro escritório -> 404 (nunca vaza).
- createEpiStock: zod (catalog_id, min_quantity >= 0); associa item com org_id do tenant; NÃO
  escreve balance; UNIQUE(org_id, catalog_id) -> 409; catalog_id inválido (FK) -> 422.
- updateEpiStock: zod parcial; edita SÓ min_quantity; balance não editável; 404 cross-tenant.
- deleteEpiStock: confirmação na UI; ON DELETE CASCADE da 008 remove as stock_movements do
  estoque (avisar antes, padrão 007 — contar dependentes); 404 cross-tenant.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero associar EPIs ao estoque e definir a quantidade mínima de cada
  item para controlar reposição.
- (P2) Como gestor de SST, quero ver o saldo e ser alertado quando estiver abaixo da mínima,
  filtrando por status.

Success criteria mensuráveis:
- As 5 operações de CRUD do registro de estoque funcionam numa única fatia.
- O status de alerta é calculado automaticamente (saldo vs. mínima), sem intervenção manual.
- balance nunca é escrito por este CRUD (só movimentações #72).
- Itens de estoque de outro escritório nunca aparecem; getById/update/delete cross-tenant -> 404.

Edge cases:
- Quantidade mínima zero (sem alerta).
- Estoque sem movimentação (balance = 0 -> sem_saldo).
- Registro de outra organização (404 em getById/update/delete).
- Excluir estoque com movimentações associadas (CASCADE da 008 remove o histórico — avisar).

Pontos a confirmar na spec (decisões em aberto):
- Vocabulário: manter colunas balance/min_quantity e mapear DTO para currentBalance/
  minimumQuantity (sem renomear coluna).
- Coluna "Empresa" do ePGR: epi_catalog NÃO tem company_id — remover essa coluna desta fatia
  (ou tratar em fatia futura).
- Status HTTP de validação: seguir o padrão do projeto (422 para zod), não 400.
- Incluir Route Handler REST /api/v1/epi-stock (alinha com companies/ges e permite teste manual)?

FORA DE ESCOPO:
- Movimentações que alteram o saldo (#72); baixa por entrega (#19); devolução (#20); CRUD do
  catálogo (#18); qualquer alteração do modelo 008 (renome de coluna, company_id, ON DELETE).

Conteúdo da spec em pt-BR; branch e commits em inglês.
NÃO invente solução técnica — descreva o "o quê" e o "porquê".
```

---

## 14. Registro de implementação (2026-06-24)

Implementado **da forma recomendada** (padrão da `007`). As 5 decisões em aberto (§9) foram
resolvidas assim:

- **§9.1 vocabulário**: mantidas as colunas reais `balance`/`min_quantity`; os **DTOs** expõem
  `currentBalance`/`minimumQuantity`. **Sem migration nova.**
- **§9.2 coluna "Empresa"**: **removida** desta fatia (sem origem no modelo — `epi_catalog` não
  tem `company_id`). Colunas do list: CA · Nome · Tam. · Und. Medida · Mínima · Saldo · Status.
- **§9.3 exclusão**: **avisar** (padrão `007`) — `countEpiStockDependents` conta as
  `stock_movements` que serão removidas em **CASCADE**; sem bloqueio.
- **§9.4 REST**: **incluído** `/api/v1/epi-stock` (alinha com `companies`/`ges` e permite teste no
  Postman).
- **§9.5 erros**: seguindo o padrão do projeto — `VALIDATION → 422`, `DUPLICATE → 409`,
  `FK_NOT_FOUND → 422`, `NOT_FOUND → 404`, `FORBIDDEN → 403` (via `toActionError`/`rest.ts`).

### Regras-chave aplicadas

- **`balance` somente leitura**: `create` insere sem `balance` (default 0); `update` faz `set`
  **apenas** de `min_quantity`. Nunca há escrita de saldo neste CRUD.
- **Status derivado**: função pura `deriveStockStatus(balance, min)` + **espelho `CASE` no SQL**
  para filtro/ordenação (`sem_saldo` = saldo 0; `abaixo_minima` = 0<saldo<mín; `acima_minima` =
  saldo≥mín). Mínima 0 ⇒ sem alerta.
- **Isolamento**: tudo via `requireOfficeStaff()` + `withOrg`; RLS `app_runtime` backstop;
  `auditedTenantWrite`/`logTenantEvent` sem PII em create/update/delete.
- **Criar**: seletor mostra só itens do catálogo **ainda sem estoque**
  (`listAvailableCatalogOptions`, padrão "available" do GES); `UNIQUE(org, catalog)` → 409.

### Arquivos criados/alterados

- **Domínio/validação**: `src/shared/domains/pgr/epi-stock.ts` (schemas zod, `deriveStockStatus`,
  DTOs, mappers); `+epiMinQuantitySchema` em `src/shared/domains/pgr/validation.ts`.
- **Repositório**: `src/shared/db/repositories/epi-stock.ts`
  (`list`/`getById`/`create`/`update`/`delete`/`countDependents`/`listAvailableCatalogOptions`).
- **Server Actions**: `src/shared/server/actions/pgr/epi-stock.ts` (7 actions, `officeAction`).
- **REST**: `src/app/api/v1/epi-stock/route.ts`, `…/[id]/route.ts`, `…/[id]/dependents/route.ts`.
- **UI** (App Router): `src/app/(protected)/epi-stock/` — `page.tsx` (list+filtros), `new/page.tsx`,
  `[id]/edit/page.tsx`, `_components/{epi-stock-form,delete-epi-stock,status-badge}.tsx`;
  link "Estoque de EPI" no nav (`(protected)/layout.tsx`).
- **Testes**: unit `src/__tests__/unit/domains/pgr/epi-stock.test.ts` (status + zod);
  integração `src/__tests__/integration/pgr/epi-stock.test.ts` (CRUD, 404 cross-tenant, 409
  UNIQUE, FK_NOT_FOUND, VALIDATION, `balance` read-only, filtros/status, FORBIDDEN).

### Estado da verificação

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run test` ✅ (**192** unit, +14 da fatia).
- Integração (`epi-stock.test.ts`) **carrega e pula** sem Postgres descartável (`INTEGRATION_*`)
  — **não executada contra o Supabase de dev** (a suíte faz `TRUNCATE`; rodar lá apagaria dados).
  **Pendente**: rodar contra um Postgres efêmero dedicado.
- **Smoke test read-only** do REST contra o banco real: `GET /api/v1/epi-stock` → **200**
  (`{rows:[],total:0}`); filtro `?status=sem_saldo` → **200**. Endpoint no ar.

### Fora desta fatia (inalterado)

Movimentações que alteram o saldo (#72); entrega (#19); devolução (#20); CRUD do catálogo (#18);
qualquer mudança do modelo `008`.

---

## 15. Prompt DETALHADO para `/speckit-specify` (reflete a implementação)

> Versão completa e definitiva — embute **todas** as decisões já tomadas (§9/§14), os **nomes
> reais** do modelo `008` e o padrão da `007`. Copie o bloco inteiro (começa em
> `/speckit-specify`) e rode. Como a fatia já foi implementada, a spec gerada serve de
> documentação formal/retroativa alinhada ao código.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/epi-stock-crud

Feature: CRUD do estoque de EPI (epi_stock) — UI + Server Actions + REST

CONTEXTO E OBJETIVO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria
(1 issue = 1 branch = 1 spec), análoga à 007 (CRUD do PGR sobre o modelo da 006). Entrega o CRUD
completo do REGISTRO de estoque de EPI: listar, detalhar, criar (associar um item do catálogo ao
estoque), editar (definir/editar a quantidade mínima) e excluir. É a primeira fatia de fluxo do
módulo de EPIs (Fase 2) sobre a fundação de dados da 008.

MODELO JÁ EXISTENTE (não criar/alterar):
O card cita a issue de modelo "#17" — no repositório isso é a fatia 008
(.specs/008-epi-data-model/). A tabela epi_stock JÁ existe em src/shared/db/schema/epis.ts
(migrations 0007/0008), com colunas REAIS:
- balance (integer NOT NULL DEFAULT 0) — o "saldo atual" / "current_balance" do ePGR;
- min_quantity (integer NOT NULL DEFAULT 0) — a "quantidade mínima";
- catalog_id (FK -> epi_catalog ON DELETE CASCADE); org_id (tenant);
- UNIQUE(org_id, catalog_id); CHECK balance >= 0; CHECK min_quantity >= 0; timestamps + trigger.
A taxonomia é a tabela `categories` (NÃO existe epi_categories). epi_catalog NÃO tem company_id.
Leia .specs/008-*, .specs/007-*, .specs/006-* e os repositórios companies.ts/ges.ts e o contrato
src/shared/server/result.ts antes de escrever a spec. Liste os arquivos que vai ler.

REGRAS NÃO-NEGOCIÁVEIS (constituição / Modelo B):
- Tenant ativo = escritório = orgs.id via requireTenantContext() + withOrg(); NUNCA Clerk org,
  organization_id nem input do cliente. RLS no papel app_runtime é backstop.
- Autorização por papel: requireOfficeStaff() (owner/collaborator operam; client -> 403/forbidden
  em páginas e FORBIDDEN nas actions). Aplica-se também a leituras.
- Toda Server Action valida com zod ANTES da regra e retorna ActionResult<T> (ok/fail), sem
  lançar exceção crua na UI. Escrita auditada (auditedTenantWrite/logTenantEvent) sem PII.
- Banco como fonte de verdade (constraints), validação na aplicação complementa.

DECISÕES JÁ TOMADAS (devem constar na spec):
1. Vocabulário: manter as colunas balance/min_quantity; os DTOs expõem currentBalance/
   minimumQuantity. Sem migration nova.
2. SALDO (balance) é SOMENTE LEITURA neste CRUD — alterado apenas por movimentações (#72).
   Nunca aparece em create/update.
3. STATUS é DERIVADO (sem coluna/trigger): sem_saldo / abaixo_minima / acima_minima, por
   comparação balance x min_quantity. Função pura no unit test + CASE no SQL na listagem.
4. Coluna "Empresa" do ePGR: REMOVIDA desta fatia (epi_catalog não tem company_id no modelo).
5. Exclusão: AVISAR (padrão 007) contando as stock_movements que serão removidas em CASCADE
   (sem bloqueio).
6. Camada REST /api/v1/epi-stock incluída (alinha com companies/ges; testável no Postman).
7. Mapa de erros (padrão do projeto via toActionError/rest.ts): VALIDATION->422, DUPLICATE->409,
   FK_NOT_FOUND->422, NOT_FOUND->404, FORBIDDEN->403.

STATUS DERIVADO (regra):
- sem_saldo: balance = 0;
- abaixo_minima: balance > 0 AND balance < min_quantity;
- acima_minima: balance > 0 AND balance >= min_quantity;
- mínima = 0 nunca gera alerta.

ENTIDADE E DTO:
- Registro de estoque = (catalog_id, min_quantity) por tenant; balance read-only.
- Linha da listagem: id, catalog_id, name (do catálogo), ca, size (Tam.), unit_of_measure
  (Und. Medida), minimumQuantity, currentBalance, status (derivado). SEM coluna Empresa.

OPERAÇÕES (repositório src/shared/db/repositories/epi-stock.ts + Server Actions + REST):
- listEpiStock(filters, {page,pageSize}): paginada/ordenada do tenant; INNER JOIN epi_catalog;
  status derivado por CASE; filtros "apenas com saldo" (balance>0) e status (sem_saldo/
  abaixo_minima/acima_minima); busca ilike por nome/CA; sem tenant -> vazio.
- getEpiStockById(id): 1 registro do tenant (join catálogo + status); inexistente/outro
  escritório -> 404 (nunca vaza).
- createEpiStock(input): zod (catalog_id uuid, minimumQuantity >= 0); associa item com org_id do
  tenant; NÃO escreve balance (default 0); UNIQUE(org_id, catalog_id) -> 409 (DUPLICATE);
  catalog_id inexistente (FK) -> 422 (FK_NOT_FOUND); auditado.
- updateEpiStock(id, patch): zod parcial; edita SÓ min_quantity; balance jamais no set; updated_at
  por trigger; inexistente/outro escritório -> 404; auditado.
- deleteEpiStock(id): confirmação na UI; CASCADE da 008 remove as stock_movements (avisar antes:
  countEpiStockDependents); 404 cross-tenant; auditado.
- listAvailableCatalogOptions(): itens do catálogo ainda SEM estoque (popula o seletor de criar).

UI (App Router, em src/app/(protected)/epi-stock/):
- Lista com colunas CA · Nome · Tam. · Und. Medida · Mínima · Saldo · Status · ações; filtros
  (busca, status, toggle "apenas com saldo"); badge de alerta por status; estado vazio orientando
  o primeiro cadastro; paginação.
- "Gerenciar Dados": páginas new/edit (padrão do projeto). Criar = seletor de item do catálogo +
  mínima. Editar = só a mínima (item read-only; saldo exibido como read-only).
- Exclusão com confirmação e aviso de dependentes.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero associar EPIs ao estoque e definir a quantidade mínima de cada
  item para controlar reposição.
- (P2) Como gestor de SST, quero ver o saldo e ser alertado quando estiver abaixo da mínima,
  filtrando por status e buscando por nome/CA.

Success criteria mensuráveis:
- As 5 operações de CRUD funcionam numa única fatia (list, getById, create, update, delete).
- O status de alerta é calculado automaticamente (saldo vs. mínima), sem intervenção manual e
  sem coluna no banco.
- balance NUNCA é escrito por este CRUD (só movimentações #72) — provado por teste.
- Itens de estoque de outro escritório nunca aparecem; getById/update/delete cross-tenant -> 404.
- Associar um item já no estoque -> 409; catalog_id inválido -> 422; mínima negativa -> 422.

Edge cases:
- Quantidade mínima zero (sem alerta).
- Estoque recém-criado sem movimentação (balance = 0 -> sem_saldo).
- Registro de outra organização (404 em getById/update/delete).
- Excluir estoque com movimentações associadas (CASCADE da 008 remove o histórico — avisar antes).
- Filtro de status e "apenas com saldo" combinados com busca e paginação.

TESTES OBRIGATÓRIOS (quality gate):
- Unit: deriveStockStatus (sem_saldo/abaixo_minima/acima_minima, incl. mínima=0); schemas zod
  (create/update; minimumQuantity >= 0; catalog_id uuid).
- Integração (Server Actions): list (paginação/filtros/busca), getById, create, update, delete;
  404 cross-tenant em getById/update/delete; 409 ao associar item já no estoque; FK_NOT_FOUND;
  VALIDATION; balance inalterado por create/update; FORBIDDEN para papel client.
- Isolamento multi-tenant em Postgres efêmero (INTEGRATION_*, runIsolationSuite/seed — NUNCA
  SQLite; a suíte faz TRUNCATE, então usar Postgres descartável, jamais o banco de dev).
- npm run test e npm run test:integration verdes; lint + tipos verdes.

CRITÉRIOS DE ACEITE:
- 5 operações implementadas e testadas.
- Status (Sem Saldo / Abaixo da Mínima / Acima da Mínima) derivado, sem coluna.
- Filtro "apenas com saldo" e filtro de status funcionam; busca por nome/CA funciona.
- Alerta visual distingue itens abaixo da mínima.
- balance não editável diretamente (só via #72).
- Estoque de outro escritório nunca aparece nem é acessível (RLS backstop / 404).

FORA DE ESCOPO:
- Movimentações que alteram o saldo (#72); baixa por entrega (#19); devolução (#20); CRUD do
  catálogo (#18); qualquer alteração do modelo 008 (renome de coluna, company_id, ON DELETE);
  coluna "Empresa" no list.

REFERÊNCIAS:
- Modelo-base: .specs/008-epi-data-model/ (epis.ts; migrations 0007/0008).
- Padrão de CRUD: .specs/007-pgr-base-cruds/; src/shared/server/result.ts;
  src/shared/db/repositories/{companies,ges}.ts; src/app/api/v1/*.
- .specs/006-cadastros-base-pgr/; .specs/005-modelo-tenant-gate-pro/;
  .specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md.
- Movimentações (saldo): #72. Constituição v1.2.1 — Princípios I (Modelo B) e V (integridade).

Conteúdo da spec em pt-BR; branch e commits em inglês.
NÃO invente solução técnica não descrita aqui — descreva o "o quê" e o "porquê".
```
