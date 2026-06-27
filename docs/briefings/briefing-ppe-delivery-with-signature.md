# Briefing — Entrega de EPI com assinatura digital (`ppe-delivery-with-signature`)

> **Tipo de fatia**: Fluxo multi-etapa (wizard App Router + Server Actions + **rota pública sem
> Clerk**) sobre o modelo `008`. É o **`#19`** que a `010` deixou explicitamente fora de escopo:
> a entrega de EPI a um funcionário que gera o movimento `employee_delivery` e **dá baixa no estoque**.
> **Entidades**: `epi_deliveries` (cabeçalho da entrega + status de assinatura + token) e
> `epi_delivery_items` (itens × quantidade), + `stock_movements` (`employee_delivery`) e `epi_stock`
> (baixa do saldo).
> **Operações**: seleção de EPIs com saldo → revisão → **autenticação** (QR Code / link remoto /
> assinatura manual) → **baixa transacional de estoque** na confirmação.
> **Contexto**: Modelo B (tenant = escritório = `orgs.id`); herda padrões de `005`–`010`.
> **Depende de**: `008` (modelo `epi_deliveries`/`epi_delivery_items`/`stock_movements`/`epi_stock`),
> `009` (CRUD/leitura de `epi_stock`, `deriveStockStatus`, `listEpiStock`) e **`010`** (padrão
> **transacional de escrita do saldo**: `SELECT … FOR UPDATE` + validação `>= 0` + `InsufficientStockError`).
> **Atenção**: ao contrário da `010`, esta fatia tem **decisões genuinamente em aberto** (ver §13) e é
> **grande** — recomenda-se fatiar (ver §16).

---

## 1. Objetivo e posição na arquitetura

Entregar o **fluxo completo de entrega de EPI a um funcionário com comprovação por assinatura
digital**, equivalente a `/funcionarios/entregarepi/:id` do ePGR. Em uma sessão: o gestor seleciona
os EPIs (que têm saldo) a entregar, revisa, escolhe um **método de assinatura** (QR Code, link
remoto ou manual) e, na **confirmação**, o sistema registra a entrega e **baixa o estoque**.

**Esta fatia É o `#19`.** O briefing da `010` (movimentações) registrou: *"Movimento
`employee_delivery` (gerado pela entrega de EPI, `#19`) e a baixa por entrega — fora de escopo"*.
Aqui implementamos exatamente isso. Tecnicamente, **reutiliza o coração da `010`**: a baixa de cada
item é um `registerStockExit` especializado (`type = 'employee_delivery'`, com `delivery_id`), na
**mesma transação atômica** que cria a entrega e seus itens.

**Novidade desta fatia (e maior risco):** uma **rota pública, sem sessão Clerk**, em que o
funcionário confirma o recebimento por uma URL com **token de capacidade**. É o **primeiro caminho de
escrita não autenticado** do projeto — exige um padrão novo de isolamento (tenant derivado **do
token**, nunca da sessão; nunca expor `organization_id`). Ver §7.

## 2. Padrões herdados (obrigatórios — vêm de 005–010)

- **Contrato de retorno**: `ActionResult<T> = {ok:true; data} | {ok:false; error:{code,message,fields?}}`
  (`src/shared/server/result.ts`). Server Actions nunca lançam exceção crua na UI.
- **Autorização por papel** (caminho interno): `requireOfficeStaff()` — `owner`/`collaborator`
  operam; `client` → `ForbiddenError`/403.
- **Isolamento (Modelo B)** no caminho interno: `withOrg(orgId, tx => …)`; tenant de
  `requireTenantContext()`, **nunca** Clerk org / `organization_id` / input do cliente. RLS
  `app_runtime` é backstop. (O caminho **público** tem um modelo próprio — §7.)
- **Escrita auditada**: `auditedTenantWrite(orgId, "<evento>", fn)` + `logTenantEvent` sem PII.
  Sugestão: `epi.delivery.write_rejected` / `epi.delivery.sign_rejected`.
- **Validação zod ANTES da regra**; mapa de erros em `src/shared/api/rest.ts`
  (`VALIDATION→422`, `DUPLICATE→409`, `FK_NOT_FOUND→422`, `NOT_FOUND→404`, `FORBIDDEN→403`,
  `NO_TENANT_CONTEXT→403`, `INSUFFICIENT_STOCK→422` — **já adicionado na `010`**). Possíveis códigos
  novos para o token — ver §11.
- **Repositório / Actions / REST / UI**: espelhar `epi-stock.ts` e **`stock-movements.ts` (010)**.
  Paginação offset (`resolvePageParams`, `Paginated<T>`). UI em `src/app/(protected)/…`,
  primitives em `src/app/(protected)/_ui/{form,list}.tsx`.

## 3. ⚠️ Reconciliação card × repositório real — LER ANTES DE CODAR

O card usa vocabulário/arquitetura genéricos que **não batem** com o repo (mesma classe de
divergência da `009`/`010`). Resolver na spec para nascer alinhado.

| O que o card diz | O que existe de fato | Ação |
| ---------------- | -------------------- | ---- |
| `features/epis/` (actions/schema/queries/components) | `src/shared/domains/pgr/`, `src/shared/db/repositories/`, `src/shared/server/actions/pgr/`, `src/app/(protected)/…`, `src/app/api/v1/…` | Usar a estrutura real |
| `organization_id` (Clerk) como escopo | tenant = `orgs.id` via `requireTenantContext()` + `withOrg`; RLS backstop | **Nunca** Clerk org / input; sempre tenant da sessão (caminho interno) |
| Integração em **SQLite em memória** | fatias com RLS/CHECK/transação testam contra **Postgres efêmero** (`INTEGRATION_*`) | Esta fatia depende de transação/CHECK/RLS + rota pública → **Postgres efêmero**, nunca SQLite |
| **"reutiliza infra de assinatura da Fase 0"** | **NÃO existe** código de assinatura/entrega — só as **colunas** da `008` (`authToken`, `signature_status`) | **Construir do zero** sobre as colunas; não há helper de assinatura para reusar |
| rota `/funcionarios/entregarepi/:id` | app usa `/employees/[id]`; a entrega seria, ex., `/employees/[id]/epi-delivery` (ou `/epi-deliveries/new?employeeId=`) | Reconciliar mantendo o padrão do projeto (inglês, kebab) |
| rota pública `/autenticacaoentregaepi/:param` | não existe; precisa ser **fora do `(protected)`** e liberada no **`src/proxy.ts`** (não `middleware.ts`) | Ex.: `/epi-deliveries/sign/[token]` + liberar no `createRouteMatcher` (§7) |
| Middleware Clerk em `middleware.ts` | Next 16 usa **`src/proxy.ts`** (`clerkMiddleware` + `createRouteMatcher`) | Editar `src/proxy.ts` para liberar a rota pública |
| Ref. `.specs/004-epgr-feature-parity/03-epi-estoque.md` | **não existe**; o `004` aqui é `multi-tenant-isolation` | Corrigir referências; usar `.specs/008-epi-data-model/` e os briefings |
| `useReducer`/Zustand para o wizard | projeto não usa Zustand; componentes client com `useState`/`useTransition` (ver `register-entry.tsx` da 010) | `useState`/`useReducer` locais; sem nova dependência sem necessidade |

## 4. ⚠️ Reconciliação card × modelo real (008) — o que existe e o que falta

Boa notícia: a `008` **antecipou** este fluxo. Schema real (`epis.ts`, migration `0007`):

```
epi_deliveries:
  id, org_id (→ orgs CASCADE), employee_id (→ employees CASCADE),
  delivery_date (date, default now),
  signature_status (enum epi_signature_status: pending | signed_qr | signed_link | signed_manual, default 'pending'),
  auth_token (text, NULLABLE; UNIQUE parcial WHERE auth_token IS NOT NULL),
  created_at, updated_at ; indexes org_id, employee_id ; RLS isolation

epi_delivery_items:
  id, org_id, delivery_id (→ epi_deliveries CASCADE),
  catalog_id (→ epi_catalog ON DELETE RESTRICT),  ← guarda CATALOG_ID, não stock_id
  quantity (integer, CHECK quantity > 0),
  timestamps ; RLS isolation

stock_movements: já tem type 'employee_delivery' e delivery_id (→ epi_deliveries ON DELETE SET NULL).
epi_stock: balance (CHECK >= 0), min_quantity ; UNIQUE(org_id, catalog_id).
```

| Necessidade do card | Existe? | Realidade / ação |
| ------------------- | ------- | ---------------- |
| Cabeçalho da entrega (funcionário + data) | ✅ `epi_deliveries` | `employee_id` + `delivery_date` |
| Itens × quantidade | ✅ `epi_delivery_items` | guarda **`catalog_id`** + `quantity` (mapear do item de estoque escolhido — ver §5) |
| Status de assinatura (3 métodos) | ✅ `signature_status` | `pending` → `signed_qr` / `signed_link` / `signed_manual` |
| Token QR/link | ✅ `auth_token` (único parcial) | gerar token de alta entropia; o token É a chave de busca da rota pública |
| Movimento de baixa | ✅ `employee_delivery` + `delivery_id` | um `stock_movements` por item, ligado à entrega |
| Baixa do saldo | ✅ `epi_stock.balance` (CHECK ≥ 0) | reusar o transacional da `010` (`FOR UPDATE` + validação) |
| **Expiração do token** | ❌ **NÃO existe** coluna | **Decisão (§13)**: derivar expiração de `created_at` + janela fixa (sem coluna) **ou** migration com `auth_token_expires_at`. "Token expirado" do card exige isso |
| **Contato p/ "Enviar Link"** | ⚠️ `employees.email`/`phone` existem; **envio NÃO** | Gerar o link é viável; **enviar** por e-mail/SMS exige provider inexistente → §13/§14 |
| **Usuário que registrou** | ❌ sem `created_by` | Omitir (como na `010`) |
| **Realtime** ("Aguardando confirmação…") | ❌ sem infra | **Polling** recomendado (§8); Supabase Realtime é opção, não requisito |

## 5. Lógica central — entrega = UMA transação atômica multi-item (com baixa na confirmação)

Cada item entregue é uma **saída** (`-quantity`) do tipo `employee_delivery`. `quantity` é sempre
positivo (CHECK). A diferença para a `010` é que a entrega tem **N itens** e um cabeçalho — tudo deve
ser **atômico**.

**Mapa de dados importante:** a seleção é feita sobre `epi_stock` (itens com saldo), mas
`epi_delivery_items` guarda **`catalog_id`**. Logo, por item selecionado: resolver `catalog_id` a
partir da linha de `epi_stock` (`epi_stock.catalog_id`), e a baixa é nessa mesma linha de `epi_stock`.

**Quando dar baixa?** O card diz **"baixa ao confirmar a entrega (qualquer método)"**. Mas QR/link
exigem que a entrega **exista** (com `auth_token` + itens) **antes** da assinatura. Há duas
arquiteturas — **decisão em aberto (§13.1)**:

- **(A) Recomendada — criar pendente, baixar na confirmação:**
  1. *Autenticar* (passo 3) cria `epi_deliveries` (`pending`, com `auth_token`) + `epi_delivery_items`,
     **validando disponibilidade** (saldo ≥ quantidade) no momento — mas **sem** mexer no saldo ainda.
  2. *Confirmação* (QR/link/manual) executa, **numa transação**: para cada item →
     `SELECT … FOR UPDATE` em `epi_stock` → revalida `balance - quantity >= 0` (senão
     `INSUFFICIENT_STOCK` + rollback) → `INSERT stock_movements(employee_delivery, stock_id,
     delivery_id, quantity, movement_date = delivery_date)` → `UPDATE epi_stock.balance -=
     quantity`; e `UPDATE epi_deliveries.signature_status = signed_*`.
  - *Prós*: o saldo só some quando há comprovação; reflete o card. *Contra*: janela entre criar e
    assinar em que o saldo "disponível" ainda não caiu (possível over-promise) — mitigado pela
    **revalidação com `FOR UPDATE` na confirmação** (a baixa é a fonte da verdade).
- **(B) Reservar na criação:** baixa o saldo já ao criar a entrega `pending`. *Contra*: se a
  assinatura nunca vem, o estoque fica "preso" — precisa de expiração/cancelamento que estorne. Mais
  complexo; **não recomendado** para o MVP.

> **Invariante a preservar (herdada da 010):** `epi_stock.balance` só muda por movimentações;
> `SUM(signed_quantity)` do histórico continua batendo com `balance`. A baixa por entrega entra
> nessa conta como `employee_delivery` (−).

**Alerta de mínima:** após a baixa, comparar `novoSaldo` com `min_quantity` via `deriveStockStatus`
(009). Se `abaixo_minima`/`sem_saldo`, devolver um **aviso** no resultado (não bloqueia a entrega).

## 6. Ciclo de vida da assinatura (máquina de estados de `signature_status`)

```
pending ──(QR confirmado na rota pública)──────────▶ signed_qr      + baixa de estoque
pending ──(link confirmado na rota pública)────────▶ signed_link    + baixa de estoque
pending ──("Registrar assinatura manual" pelo gestor)─▶ signed_manual + baixa de estoque
```

- A transição para `signed_*` é **única** (idempotência: já assinada → rejeitar nova confirmação →
  token "já utilizado", §11).
- A **baixa ocorre junto** com a transição (mesma transação). Nunca assinar sem baixar, nem baixar
  sem assinar.
- `auth_token` faz sentido para QR/link; para manual pode ser nulo. A unicidade é parcial
  (`WHERE auth_token IS NOT NULL`), então múltiplas entregas manuais (token nulo) convivem.

## 7. 🔐 Rota PÚBLICA sem Clerk — o ponto crítico de segurança (padrão novo)

O funcionário confirma por uma URL pública (`/epi-deliveries/sign/[token]`), **sem login**. Regras:

- **Liberar no `src/proxy.ts`**: adicionar ao `createRouteMatcher([...])` os paths públicos, ex.
  `"/epi-deliveries/sign/(.*)"` (página) e o endpoint de confirmação público (ex.
  `"/api/public/epi-deliveries/(.*)"`). Hoje o matcher tem `/`, `/sign-in`, `/sign-up`,
  `/api/webhooks/*` (+ `/api/v1/*` só no bypass dev). **NÃO** usar o bypass dev para isto.
- **Acesso por capacidade (token), não por sessão**: a rota recebe o `token`, busca a entrega por
  `auth_token` (globalmente único). O **`org_id` é derivado da própria entrega**, no servidor; a
  baixa roda via `withOrg(delivery.orgId, …)`. O tenant **nunca** vem de header/sessão do visitante.
- **Não expor `organization_id`** nem dados de outras orgs. A tela pública mostra **só** o mínimo
  (nome do funcionário, itens/quantidades, data) necessário para a confirmação. Nada de listagens.
- **Busca por token cross-tenant**: como não há sessão/tenant, a leitura inicial do token precisa
  acontecer **sem** o filtro RLS por `app.current_org`. Decisão (§13.4): usar uma conexão/ápi
  server-side específica (ex. consulta restrita por `auth_token` que não depende de
  `current_setting`), retornando **uma** entrega. Documentar e testar que esse caminho **só** acessa
  a linha do token.
- **Token forte e de uso único**: gerar com `crypto.randomUUID()`/bytes aleatórios (alta entropia);
  invalidar após `signed_*` (status != pending). Expiração: §13.2.
- **Rate limiting / no-store**: a rota pública não deve ser cacheada (já há `NO_STORE` para `/api/`;
  considerar para a página). Rate-limit é desejável (anti-brute-force do token) — §14.

> Este é o maior risco da fatia. O caminho público combina **escrita** (baixa de estoque) +
> **sem autenticação** + **multi-tenant**. Testes de isolamento dedicados são obrigatórios (§12).

## 8. Tempo real — "Aguardando confirmação…"

Após exibir o QR, o painel do gestor deve refletir a confirmação do funcionário.

- **Recomendado (MVP): polling curto** (ex. 4–5s) de um endpoint/action que lê o
  `signature_status` da entrega (escopo do tenant). Simples, sem dependência nova, funciona com o
  `restHandler`/`officeAction` existentes.
- **Alternativa**: Supabase Realtime (`@supabase/supabase-js` está nas deps) — mais "instantâneo",
  porém adiciona complexidade (canal, auth, RLS no realtime). **Decisão §13.3**; default = polling.

## 9. Operações (repositório + Server Actions + REST)

Caminho **interno** (gestor) — org-scopado (`requireOfficeStaff` → `withOrg`). Sugestão de
assinaturas (espelhando `stock-movements.ts`/`epi-stock.ts`):

| Operação | Assinatura (repo) | Comportamento |
| -------- | ----------------- | ------------- |
| Listar EPIs entregáveis | reusar `listEpiStock(orgId, {withBalanceOnly:true, search})` (009) | só itens com `balance > 0`; busca por CA/nome (já existe) |
| Criar entrega (pendente) | `createDelivery(orgId, {employeeId, deliveryDate, items:[{stockId, quantity}]})` | valida funcionário do tenant; valida cada item (existe, mesmo tenant, saldo ≥ qtd); gera `auth_token`; INSERT `epi_deliveries` + `epi_delivery_items`; **arquitetura A: sem baixa ainda**; auditado |
| Registrar assinatura manual | `signDeliveryManual(orgId, deliveryId)` | `pending`→`signed_manual` + **baixa transacional** (§5); 404 cross-tenant; já assinada → conflito |
| Status da entrega (polling) | `getDeliveryStatus(orgId, deliveryId)` | retorna `signature_status` (+ itens/saldos) |
| Histórico/visualizar entrega | `getDelivery(orgId, deliveryId)` | cabeçalho + itens; reusa join de funcionário |

Caminho **público** (funcionário, sem sessão):

| Operação | Assinatura | Comportamento |
| -------- | ---------- | ------------- |
| Carregar entrega por token | `getDeliveryByToken(token)` | busca por `auth_token` (sem tenant); 404 se inexistente; 409/410 se já assinada/expirada; retorna **dados mínimos** |
| Confirmar (QR/link) | `confirmDeliveryByToken(token, method)` | valida token (pendente, não expirado) → deriva `org_id` → **baixa transacional** (§5) + `signed_qr`/`signed_link`; idempotente |

- Função pura reutilizável: a baixa por item é o `registerStockExit` da `010` generalizado para
  `employee_delivery` + `delivery_id`. **Refatorar** a `010` para extrair um helper interno de baixa
  (mantendo o comportamento atual) é desejável, evitando duplicar a lógica do `FOR UPDATE`.

## 10. UI (App Router)

- **Passo 1 — Seleção** (ex. `/employees/[id]/epi-delivery`): cabeçalho Empresa + Funcionário;
  tabela de `epi_stock` com saldo (`CA · EPI · Tam. · Und. · Descrição · Fabricante · Disponível ·
  Quantidade`), checkbox habilita o campo Quantidade; busca por CA/nome; "Revisar e confirmar".
- **Passo 2 — Revisão (modal)**: "Itens para Entrega (N)", `Data de Entrega`, Funcionário;
  "Autenticar N EPI(s)".
- **Passo 3 — Autenticação (modal, abas)**: **QR Code** (exibe QR do token + painel "Aguardando
  confirmação…" com polling); **Enviar Link** (gera link; se sem e-mail/telefone → "Ir para cadastro
  do funcionário"); **Assinatura Manual** ("Registrar assinatura manual" + opção de imprimir ficha).
- **Tela pública** `/epi-deliveries/sign/[token]` (**fora do `(protected)`**, layout sem sidebar):
  mostra os itens/quantidades e botão "Confirmar recebimento".
- Estado do wizard: `useState`/`useReducer` no client (padrão dos componentes da 010); sem Zustand
  salvo necessidade real.

## 11. Validação, erros e auditoria

- **zod**: `deliveryCreateSchema` (`employeeId` uuid; `deliveryDate` date; `items` array não-vazio de
  `{stockId uuid, quantity int > 0}`; sem duplicar `stockId`); schema do método de assinatura.
- **Erros** (reusar o mapa; `INSUFFICIENT_STOCK→422` já existe da 010). Novos prováveis:
  - token inexistente → **404** (`NOT_FOUND`);
  - token já utilizado (status != pending) → **409** (`DUPLICATE`/novo `ALREADY_SIGNED`);
  - token expirado → **410** ou **422** (novo `TOKEN_EXPIRED`) — alinhar com `rest.ts`;
  - funcionário sem contato (Enviar Link) → erro de UX, não HTTP (orienta cadastro).
- **Auditoria**: `auditedTenantWrite`/`logTenantEvent` (sem PII) na criação e na assinatura
  (inclusive a confirmação pública, com `org_id` derivado do token).

## 12. Concorrência, atomicidade e testes

- **Atomicidade**: criação (entrega + itens) e confirmação (baixa N itens + status) cada uma em
  **uma** transação (`withOrg`). `SELECT … FOR UPDATE` por linha de `epi_stock` na confirmação.
- **Backstop**: `CHECK balance >= 0` aborta corridas que escapem da validação.
- **Testes (quality gate — obrigatórios), em Postgres efêmero** (`INTEGRATION_*`, **nunca SQLite**,
  nunca o banco de dev — suítes fazem `TRUNCATE`):
  - **Unit**: schemas zod (items não-vazio, quantity > 0, sem stockId duplicado); helper de baixa
    (sinal/efeito de `employee_delivery`); máquina de estados (transições válidas/idempotência).
  - **Integração (Server Actions)**: criar entrega pendente; assinatura manual baixa o saldo e cria
    `employee_delivery` (1 por item) ligado ao `delivery_id`; **saldo insuficiente → rollback total**
    (nem entrega assinada, nem movimento, nem baixa); só itens com saldo aparecem; alerta de mínima.
  - **Integração (rota pública)**: confirmar por token baixa o estoque na org correta; **token de
    outra org não vaza dados** e a confirmação **só** afeta a entrega do token; token inexistente →
    404; já utilizado → 409; (expirado, conforme §13).
  - **Isolamento multi-tenant**: caminho interno e **público** (o crítico) — dados não cruzam orgs.
  - `npm run test` + `npm run test:integration` verdes; `lint` + `tsc --noEmit` verdes.

## 13. ⚠️ Decisões em ABERTO (a spec/`/speckit-clarify` precisa resolver)

Diferente da `010` (tudo travado), aqui há escolhas reais. Recomendações em **negrito**.

1. **Momento da baixa**: **(A) criar pendente + baixar na confirmação** (recomendado) vs (B) reservar
   na criação. (§5)
2. **Expiração do token**: **derivar de `created_at` + janela fixa (ex. 72h), sem coluna** (zero
   migration) vs adicionar `auth_token_expires_at` (migration). Se a expiração for requisito firme, a
   coluna é mais explícita. (§4/§11)
3. **Tempo real**: **polling 5s** (recomendado, MVP) vs Supabase Realtime. (§8)
4. **Leitura do token sem tenant**: definir o mecanismo exato (consulta server-side que não depende
   de `current_setting`) e provar por teste que só acessa a linha do token. (§7)
5. **"Enviar Link" — envio real**: há provider de e-mail/SMS? Se **não**, o MVP **gera e exibe/copia
   o link** (e registra), deixando o disparo por e-mail/SMS para fatia futura. (§4/§14)
6. **Ficha de controle (assinatura manual)**: imprimir uma página print-friendly agora, ou **fora do
   MVP**? (§14)
7. **Rota pública (nome)**: `/epi-deliveries/sign/[token]` (recomendado) vs manter o termo do card.
8. **Fatiamento**: implementar tudo de uma vez ou faseado (recomendado — §16)?

## 14. Fora de escopo (sugerido — confirmar na spec)

- **Disparo real** de e-mail/SMS para o "Enviar Link" (sem provider configurado) — gerar o link
  fica no escopo; enviar, não (fatia futura).
- **Devolução/estorno** de entrega (`#20`) e cancelamento que reverte a baixa.
- **Ajuste do modelo `008`** (ex. `created_by`; `auth_token_expires_at` só se §13.2 escolher coluna).
- **Geração de PDF** sofisticada da ficha (um print-friendly simples pode entrar; PDF rico, não).
- Catálogo (`#18`) e CRUD de estoque (`009`, já feito) e movimentações manuais (`010`, já feito).

## 15. Critérios de aceite (do card, reconciliados)

- [ ] Fluxo 3 passos (seleção → revisão → autenticação) ponta a ponta.
- [ ] Os 3 métodos (QR, Link, Manual) implementados conforme o escopo decidido (§13.5).
- [ ] Rota pública `/epi-deliveries/sign/[token]` acessível **sem login Clerk** (liberada no `proxy.ts`).
- [ ] Painel "Aguardando confirmação…" atualiza após confirmação via QR (polling).
- [ ] Baixa registrada em `stock_movements` (`employee_delivery`, 1/item, com `delivery_id`) e em
  `epi_stock.balance`, **na confirmação**, em transação (rollback se algum item faltar saldo).
- [ ] Alerta se o saldo ficar **abaixo da mínima** após a baixa.
- [ ] Só EPIs com `balance > 0` aparecem na seleção.
- [ ] Funcionário e EPIs pertencem à **organização ativa**; a rota pública **não** expõe dados de
  outras orgs e o token só afeta a própria entrega.
- [ ] `npm run test` + `npm run test:integration` (incl. isolamento interno **e público**) verdes.

## 16. Recomendação de fatiamento (esta fatia é grande)

Considerar dividir em incrementos entregáveis (cada um com testes):

1. **MVP — entrega + assinatura manual + baixa**: passos 1–2, criar entrega, "Registrar assinatura
   manual", baixa transacional, alerta de mínima, isolamento. **Já entrega valor legal** sem a parte
   pública. (Menor risco; prova o transacional multi-item.)
2. **QR + rota pública**: token, `/epi-deliveries/sign/[token]`, confirmação pública, painel de
   espera (polling), testes de isolamento público. (Maior risco — o §7.)
3. **Enviar Link** (e, se houver provider, disparo) + ficha de impressão + (opcional) Realtime.

Se for fatia única, priorizar o **MVP (1)** e o **caminho público (2)** com testes antes do polimento.

## 17. Referências

- Modelo-base: **`008`** — `.specs/008-epi-data-model/`, `src/shared/db/schema/epis.ts`
  (`epi_deliveries`, `epi_delivery_items`, `stock_movements`, `epi_stock`), migration `0007`.
- Fatia de saldo (read-only): **`009`** — `src/shared/db/repositories/epi-stock.ts`
  (`listEpiStock`, `deriveStockStatus`, `countEpiStockDependents`).
- Fatia transacional (escreve saldo): **`010`** — `docs/briefings/briefing-stock-movements.md`,
  `src/shared/db/repositories/stock-movements.ts` (padrão `FOR UPDATE` + `InsufficientStockError`).
- Middleware/rota pública: **`src/proxy.ts`** (`clerkMiddleware` + `createRouteMatcher`).
- Isolamento: `.specs/004-multi-tenant-isolation/`; `src/shared/db/with-org.ts`.
- UI de funcionários (gancho do passo 1): `src/app/(protected)/employees/`.
- Constituição v1.2.1 — Princípios I (Modelo B) e V (integridade no banco).

---

## 18. Prompt para `/speckit-specify` (reconciliado com o repo real)

> Copie o bloco abaixo (começa em `/speckit-specify`). Já incorpora as reconciliações (§3/§4),
> o caminho público (§7), o transacional multi-item (§5) e marca as **decisões em aberto** (§13)
> para o `/speckit-clarify` resolver. Conteúdo da spec em pt-BR; branch e commits em inglês.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/ppe-delivery-with-signature

Feature: PPE delivery with digital signature (entrega de EPI com assinatura)

CONTEXTO E OBJETIVO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria
(1 issue = 1 branch = 1 spec). Entrega o fluxo de ENTREGA de EPI a um funcionário com assinatura
digital, equivalente a /funcionarios/entregarepi/:id do ePGR. É o "#19" que a fatia 010 (movimentações)
deixou FORA de escopo: aqui o movimento employee_delivery é gerado e o estoque sofre BAIXA.
Reutiliza o transacional da 010 (SELECT ... FOR UPDATE + validação de saldo + InsufficientStockError).
ATENÇÃO: NÃO existe "infra de assinatura da Fase 0" no repo — só as COLUNAS da 008 (auth_token,
signature_status); a lógica de assinatura é construída do zero nesta fatia.

ANTES DE ESCREVER A SPEC, leia e liste:
- src/shared/db/schema/epis.ts (epi_deliveries, epi_delivery_items, stock_movements, epi_stock; enums)
- src/shared/db/repositories/stock-movements.ts e epi-stock.ts (padrão de baixa transacional e leitura)
- src/shared/domains/pgr/stock-movements.ts e epi-stock.ts; src/shared/server/result.ts; src/shared/api/rest.ts
- src/proxy.ts (clerkMiddleware + createRouteMatcher — onde liberar a rota pública)
- src/app/(protected)/employees/* (gancho do passo 1) e src/app/(protected)/_ui/{form,list}.tsx
- src/__tests__/integration/pgr/stock-movements.test.ts e _helpers/{db,pgr-seed}.ts (padrão de teste)
- docs/briefings/briefing-stock-movements.md e este briefing (fonte das decisões)

MODELO JÁ EXISTENTE (NÃO criar/alterar — alvo ZERO migration, salvo decisão de expiração com coluna):
- epi_deliveries: id, org_id (→orgs CASCADE), employee_id (→employees CASCADE), delivery_date (date),
  signature_status (enum: pending|signed_qr|signed_link|signed_manual, default pending),
  auth_token (text NULLABLE, UNIQUE parcial WHERE not null), timestamps; RLS.
- epi_delivery_items: id, org_id, delivery_id (→epi_deliveries CASCADE), catalog_id (→epi_catalog RESTRICT),
  quantity (int, CHECK > 0); RLS.  -> guarda catalog_id, não stock_id.
- stock_movements: já tem type 'employee_delivery' e delivery_id (→epi_deliveries SET NULL).
- epi_stock: balance (CHECK >= 0), min_quantity; UNIQUE(org_id, catalog_id).
GAPS: sem coluna de EXPIRAÇÃO de token; sem created_by; envio de e-mail/SMS inexistente; realtime inexistente.

REGRAS NÃO-NEGOCIÁVEIS (constituição / Modelo B):
- Caminho INTERNO (gestor): tenant = orgs.id via requireTenantContext() + withOrg(); requireOfficeStaff()
  (owner/collaborator; client -> 403). Zod antes da regra; ActionResult<T>; escrita auditada sem PII.
- Caminho PÚBLICO (funcionário, sem Clerk): acesso por CAPACIDADE (auth_token). O org_id é derivado da
  PRÓPRIA entrega (server-side), nunca de sessão/header/input. NUNCA expor organization_id nem dados de
  outras orgs. Liberar a rota no src/proxy.ts (createRouteMatcher), sem usar o bypass dev.
- Estrutura real (NÃO "features/epis/"): domínio src/shared/domains/pgr/, repo src/shared/db/repositories/,
  actions src/shared/server/actions/pgr/, UI src/app/(protected)/..., REST src/app/api/v1/..., rota
  pública fora do (protected).

LÓGICA CENTRAL (transação atômica):
- Entrega = cabeçalho (1 funcionário, 1 data) + N itens. Cada item entregue é uma saída
  employee_delivery (-quantity); quantity sempre > 0; o efeito vem do type.
- Mapa: seleção sobre epi_stock (itens com saldo), mas epi_delivery_items guarda catalog_id
  (= epi_stock.catalog_id); a baixa é na linha de epi_stock correspondente.
- Recomendado: criar entrega PENDENTE (com auth_token + itens), validando disponibilidade; a BAIXA
  ocorre na CONFIRMAÇÃO (QR/link/manual), numa transação: por item SELECT...FOR UPDATE epi_stock,
  revalida balance - quantity >= 0 (senão INSUFFICIENT_STOCK + rollback total), INSERT stock_movements
  (employee_delivery, stock_id, delivery_id, movement_date=delivery_date), UPDATE balance -= quantity;
  e signature_status -> signed_*. Tudo atômico. CHECK balance >= 0 é backstop.
- Após a baixa, alertar se balance < min_quantity (deriveStockStatus), sem bloquear.

ASSINATURA (3 métodos) e ESTADO:
- pending -> signed_qr | signed_link (confirmados na rota pública por token) | signed_manual
  ("Registrar assinatura manual" pelo gestor). Transição única (idempotente; já assinada -> conflito).
- Token de alta entropia (crypto), de uso único (inválido após signed_*).

ROTA PÚBLICA:
- Página /epi-deliveries/sign/[token] (layout sem sidebar) + endpoint de confirmação público.
- Busca a entrega por auth_token SEM tenant (leitura que não depende de current_setting), retorna
  dados MÍNIMOS (funcionário, itens, data); deriva org_id e faz a baixa via withOrg(org_id).
- Painel do gestor "Aguardando confirmação..." por POLLING (ex. 5s) do signature_status.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero registrar a entrega de EPIs com assinatura digital do funcionário
  (QR Code, link ou manual) para comprovar legalmente o fornecimento, dando baixa no estoque.
- (P2) Como funcionário, quero confirmar o recebimento pelo meu celular (QR Code ou link), sem login.

Success criteria mensuráveis (tecnologia-agnósticos):
- O fluxo (seleção -> revisão -> autenticação QR) é concluído em menos de 2 minutos.
- O saldo em estoque diminui automaticamente ao confirmar a entrega; nunca fica negativo.
- A rota pública de autenticação não expõe dados de outras organizações e só afeta a entrega do token.

Edge cases:
- EPI sem saldo não aparece na seleção; saldo insuficiente na confirmação -> recusa + rollback total.
- Funcionário sem e-mail/telefone (método "Enviar Link" indisponível -> orientar cadastro).
- Token inexistente (404), já utilizado (409) ou expirado (decidir 410/422).
- Saldo abaixo da mínima após a baixa (alerta).
- Duas confirmações concorrentes da mesma entrega (idempotência) e duas entregas concorrentes do mesmo
  item (FOR UPDATE serializa).

DECISÕES A CLARIFICAR (rodar /speckit-clarify):
- Momento da baixa (criar pendente + baixar na confirmação [recomendado] vs reservar na criação).
- Expiração do token (derivar de created_at + janela fixa, sem coluna [recomendado] vs coluna nova).
- Tempo real (polling [recomendado] vs Supabase Realtime).
- "Enviar Link": há provider de e-mail/SMS? Se não, MVP só GERA/exibe o link (envio fica para depois).
- Ficha de impressão (manual): print-friendly agora ou fora do MVP.
- Fatiamento: MVP (entrega + manual + baixa) -> QR/rota pública -> link/realtime.

TESTES OBRIGATÓRIOS (quality gate; Postgres EFÊMERO, INTEGRATION_*, NUNCA SQLite nem banco de dev):
- Unit: schemas zod (items não-vazio, quantity>0, sem stockId duplicado); helper de baixa
  (employee_delivery -); máquina de estados/idempotência.
- Integração (actions): criar entrega pendente; assinatura manual baixa saldo + cria employee_delivery
  (1/item, com delivery_id); saldo insuficiente -> rollback total; só itens com saldo na seleção;
  alerta de mínima.
- Integração (rota pública): confirmação por token baixa na org certa; token de outra org não vaza e
  só afeta a própria entrega; token inexistente/usado/expirado.
- Isolamento multi-tenant (interno E público). npm run test e npm run test:integration verdes; lint + tipos verdes.

FORA DE ESCOPO:
- Disparo real de e-mail/SMS (sem provider) — gerar link fica no escopo, enviar não.
- Devolução/estorno da entrega (#20); alteração do modelo 008 (salvo coluna de expiração se decidido);
  PDF rico da ficha; catálogo (#18) e CRUDs já feitos (009/010).

REFERÊNCIAS:
- .specs/008-epi-data-model/ (epis.ts; migration 0007); fatia 010 (briefing-stock-movements.md;
  repositories/stock-movements.ts); fatia 009 (repositories/epi-stock.ts).
- src/proxy.ts (rota pública); .specs/004-multi-tenant-isolation/; src/shared/db/with-org.ts.
- Constituição v1.2.1 — Princípios I (Modelo B) e V (integridade no banco).

Conteúdo da spec em pt-BR; branch e commits em inglês. NÃO invente solução técnica não descrita aqui —
descreva o "o quê" e o "porquê". Marque as decisões em aberto para o /speckit-clarify.
```
