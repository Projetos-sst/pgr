# Relatório de QA — Campanha §1–§15 (v0.2.0)

/ Fonte de casos: `claudedocs/qa-mapping-detailed.md` · Ambiente: dev server `http://localhost:3000` /

## 1. Escopo e método

Execução E2E dos casos QA mapeados em `qa-mapping-detailed.md`, módulo a módulo (§1 a §15),
contra a instância de desenvolvimento em execução.

**Superfície automatizada:**

- **REST `/api/v1/*` via dev-bypass** — `DEV_API_AUTH_BYPASS=true` (só com `APP_ENV != production`),
  contexto injetado pelos headers `x-dev-tenant` / `x-dev-role` / `x-dev-user`.
  - Tenant A (dados reais): `org_3ECY...` (org de dev existente em `orgs`).
  - Cross-tenant: `x-dev-tenant: org_qa_nonexistent` (org inexistente → RLS/lookup devolve vazio →
    `NOT_FOUND` / `FK_NOT_FOUND`).
  - `FORBIDDEN`: `x-dev-role: client` (fora de `OFFICE_STAFF_ROLES`).
- **Rotas públicas por token via Playwright** — assinatura de OS/PGR
  (`/signature-requests/[token]`) e resposta anônima psicossocial
  (`/psychosocial-response/[campaignId]/[token]`), incluindo submit real de formulário/canvas.

**Fixtures:** criadas apenas marcadas (`QA-TEST...`) sob o tenant real; removidas ao fim de cada
seção (resíduos não-deletáveis por design — estados terminais/assinados, recursos sem rota DELETE —
foram listados para purge SQL do maestro).

**Convenções de contrato confirmadas no código (fonte da verdade):**

- `FK_NOT_FOUND` = **HTTP 422** (canônico em `HTTP_BY_CODE`, `src/shared/api/rest.ts`), embora o
  texto de alguns casos diga "404".
- Respostas de `create`/`update` frequentemente retornam só `{ id }`; o estado é confirmado via GET.
- Algumas listas retornam array puro (perguntas/riscos/batches eSocial), outras `{ rows, total }`.

**Não coberto por esta rodada** (ver §5): validação de RLS/constraints ao nível de banco
(depende de `INTEGRATION_DATABASE_URL` / Postgres efêmero) e integrações externas reais.

## 2. Resultado por seção

Contagens **exatas** para §10–§15. Para §1–§9, a granularidade PASS/BLOCKED foi reportada nas
rodadas correspondentes (anteriores à compactação de contexto); aqui reafirma-se **0 FAIL** em cada
e os bugs achados nelas (todos corrigidos).

| Seção         | Módulo                                         |    PASS |    FAIL | BLOCKED |                             Total |
| ------------- | ---------------------------------------------- | ------: | ------: | ------: | --------------------------------: |
| §1            | Auth / invariantes globais                     |       — |       0 |       — |                            0 FAIL |
| §2            | Empresas + Unidades de Obra                    |       — |       0 |       — |                            0 FAIL |
| §3            | GES + Funções + Funcionários                   |       — |       0 |       — |                            0 FAIL |
| §4            | EPI: Categorias/Catálogo/Estoque/Movimentações |       — |       0 |       — |          0 FAIL (BUG#1 corrigido) |
| §5            | EPI: Entrega/Devolução/Ficha/Assinatura        |       — |       0 |       — |                            0 FAIL |
| §6            | Integrações CAEPI/ViaCEP/CNPJ                  |       — |       0 |       — |    aceito (unit + gate de sessão) |
| §7            | PGR: Documento/Inventário/EPIxRisco            |       — |       0 |       — |                            0 FAIL |
| §8            | PGR: Metodologia/Avaliação/Sugestão IA         |       — |       0 |       — | 0 FAIL (BUG#2 + IA-06 corrigidos) |
| §9            | PGR: Plano/Consolidado/Revisões/Assinatura     |       — |       0 |       — |                            0 FAIL |
| §10           | Treinamentos                                   |      25 |       0 |      13 |                                38 |
| §11           | Safety (OS/Incidentes/Planos/Auditorias)       |      39 |       0 |       5 |                                44 |
| §12           | Inspeções + Permissões de Trabalho             |      30 |       0 |       3 |                                33 |
| §13           | Psicossocial + eSocial                         |      30 |     1→0 |       5 |                                36 |
| §14           | Plataforma (Dashboards/Billing/Admin/…)        |      22 |       0 |      18 |                                40 |
| §15           | Documentos/Pastas/Jobs (modelo puro)           |       0 |       0 |      26 |                                26 |
| **Σ §10–§15** |                                                | **146** | **1→0** |  **70** |                           **217** |

## 3. Bugs reais encontrados e corrigidos

Cinco defeitos de produto no total; todos corrigidos e reverificados por HTTP nesta campanha.

### BUG#1 — §4 — epi-catalog sem REST mirror (CRUD incompleto)

- **Sintoma:** recurso `epi-catalog` sem superfície RESTful (`/api/v1/epi-catalog/**`), violando a
  regra "todo CRUD exposto precisa de Server Action + REST mirror + docs + Postman".
- **Causa:** rota REST ausente.
- **Fix:** Dev adicionou `src/app/api/v1/epi-catalog/**` (list/create + `[id]` get/put/delete +
  `[id]/dependents`), reusando repo/schema.
- **Verificação:** §4 re-executado após o fix — 34 PASS, endpoints CRUD + dependents validados.

### BUG#2 — §8 — setup do cliente de IA fora do try/catch (500 em vez de 502)

- **Sintoma:** falha de setup (ex.: `ANTHROPIC_API_KEY` ausente) escapava como `500 UNKNOWN` em vez
  de `502 AI_UNAVAILABLE`.
- **Causa:** em `requestRiskSuggestions` / `requestActionPlanSuggestion`, `buildPrompt` +
  `requireAnthropicApiKey()` + `new Anthropic()` estavam **antes** do `try`.
- **Fix:** Dev moveu o setup para **dentro** do `try`; catch: `if (error instanceof
AiUnavailableError) throw error; throw new AiUnavailableError();`.
- **Arquivo:** `src/shared/integrations/ai/anthropic.ts`.
- **Verificação:** re-teste retornou `502 AI_UNAVAILABLE`.

### BUG#3 — §8 — QA-IA-06: `500 UNKNOWN` por tabela ausente no DB de dev

- **Sintoma:** `POST /api/v1/ges/[id]/risk-suggestions` em GES válido → `500 UNKNOWN` (mesmo após
  BUG#2 corrigido).
- **Causa:** `countAiUsageInCurrentMonth` consulta `ai_usage_events`; a migration `0015` não estava
  aplicada no banco de dev → SQLSTATE `42P01` (relação inexistente), não mapeado → 500.
- **Fix:** maestro reconciliou o schema de dev (aplicou `0015_ai_usage_events` e demais tabelas
  faltantes). Não era bug de código do Dev.
- **Verificação:** re-teste → `502 AI_UNAVAILABLE` ("ANTHROPIC_API_KEY não configurada").

### BUG#4 — §13 — register de risco psicossocial com `gesId` malformado → 500

- **Sintoma:** `POST /api/v1/psychosocial-campaigns/[id]/risks/[riskId]/register` com `gesId`
  não-uuid (`""`, `"abc"`, ausente) → `500 UNKNOWN`. (`gesId` uuid-válido-inexistente já retornava
  `422 FK_NOT_FOUND` corretamente.)
- **Causa:** handler fazia `String(body.gesId ?? "")` sem validar uuid; `registerRiskInPgr` executava
  `eq(ges.id, gesId)` com string crua → Postgres `22P02 invalid input syntax for type uuid`, não
  mapeado em `PG_ERROR_MAP` → 500.
- **Fix:** Dev adicionou `registerRiskInPgrSchema.parse(await req.json())` (valida `gesId` como uuid)
  no handler, antes do repo.
- **Arquivos:** `src/app/api/v1/psychosocial-campaigns/[id]/risks/[riskId]/register/route.ts`;
  schema em `src/shared/domains/psychosocial/campaigns.ts` (`registerRiskInPgrSchema`).
- **Verificação:** não-uuid → `422 VALIDATION` ("Identificador inválido"); uuid-válido-inexistente
  (com risco real não-registrado) → `422 FK_NOT_FOUND`.

### BUG#5 — §13 — QA-PSI-08: transição de status de campanha inválida aceita

- **Sintoma:** `PUT /api/v1/psychosocial-campaigns/[id]/status` aceitava transições ilegais — provado
  ao vivo `archived → active` (`200`, campanha voltava a `active`), sendo `archived` terminal. Também
  `closed → draft`, `active → draft` passariam.
- **Causa:** `setCampaignStatus` só validava `canActivateCampaign` (campanha sem perguntas) e **nunca
  chamava `canTransitionStatus(from, to)`**; `canTransitionStatus` + `STATUS_TRANSITIONS` existiam mas
  estavam desconectados do write path.
- **Fix:** Dev passou a ler o status atual e validar `canTransitionStatus(current, target)` no
  `setCampaignStatus`, lançando `ValidationError("Transição de status inválida.")` quando ilegal;
  guard de "sem perguntas" preservado.
- **Arquivos:** `src/shared/db/repositories/psychosocial-campaigns.ts` (`setCampaignStatus`);
  regra em `src/shared/domains/psychosocial/campaigns.ts` (`canTransitionStatus`,
  `STATUS_TRANSITIONS`); handler `src/app/api/v1/psychosocial-campaigns/[id]/status/route.ts`.
- **Verificação (HTTP):**
  - `archived → active` → `422 VALIDATION` "Transição de status inválida." (status permanece `archived`).
  - `archived → closed` → `422 VALIDATION`.
  - `draft → active` / `active → closed` / `closed → archived` → `200` (transições legais).
  - `active` sem perguntas → `422 VALIDATION` "Campanha sem perguntas não pode ser ativada." (guard preservado).

## 4. BLOCKED agrupados por motivo (70 casos, §10–§15)

| Motivo                                         |               Qtd | Casos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modelo puro / integração DB (§15)              |                26 | QA-DOC-01..26 (RLS 3 tabelas, `WITH CHECK` cross-tenant, uniques `uq_folders_org_parent_name` / `uq_documents_org_group_version`, `NULLS NOT DISTINCT`, RESTRICT folders→folders/documents→folders, CHECKs version/size_bytes/related_entity, claim `FOR UPDATE SKIP LOCKED`, attempts, stale claim, failed estruturado, defaults; + funções puras `classifyDocumentValidity` e `documentRelatedEntityTypeSchema`)                                                                                                                                                                           |
| Sem REST / Server Action-only                  |                30 | §10 TEXP-01..07 + TREQ-04..09 (13; vencimento/conformidade = Server Action de dashboard, sem mirror REST); §11 OS-02 (auto-sugestão de itens do GES = helper de UI); §12 INSP-13/14 (assinatura de inspeção = `requestInspectionSignatureAction`, Server Action); §13 PSI-15 (filtro de `questionId` forjado é server-side, nível unit), ESOC-02/03/05 (`generateS2200/S2240FromX`, source validation = Server Actions), ESOC-12 (sem rota REST de transição de status de evento); §14 NOTIF-03 (marcar lida = localStorage client-side), BILL-01 (`startProCheckoutAction` = Server Action) |
| UI Clerk / sessão real                         |                 9 | §12 INSP-20 (gate no-tenant vive no caminho Clerk; dev-bypass usa fallback `DEV_TENANT_ID`); §14 REL-01..04 (handler de relatório usa `requireOfficeStaff()` Clerk direto, **sem** o ramo dev-bypass do `restHandler` → `400 UNAUTHORIZED` via bypass), TEAM-03..06 (gestão de equipe exige plano Pro + Clerk org; dev-bypass fixa `plan:"free"`)                                                                                                                                                                                                                                            |
| Órfã `0018_user_is_master`                     |                 5 | §14 ADM-01..05 (Admin global = só `masterAction`, sem REST v1, **e** depende de `users.is_master` da migration 0018 não aplicada)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Stripe live / webhook assinado                 |                 3 | §14 BILL-04/05/06 (exigem assinatura HMAC Stripe válida / signing secret para `checkout.session.completed` e `customer.subscription.*`)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| LLM real (chave Anthropic)                     |                 2 | §11 AUD-06 (happy-path 5W2H de sugestão de plano por IA), AUD-08 (cota de IA)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Gotenberg (render PDF)                         | (incluído em REL) | §14 REL-01 depende também de Gotenberg up — já contado em "UI Clerk" acima por bloquear antes no gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2º tenant real / cota compartilhada destrutiva |                 2 | §11 OS-06 (número de OS por 2º tenant real), OS-14 (cota free de assinatura — exaustão de 10 pedidos/mês compartilhados é destrutiva)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Observação: a soma por rótulo pode sobrepor (ex.: um caso é ao mesmo tempo "Server Action-only" e
"órfã 0018"); o total de linhas BLOCKED distintas é **70**.

Notas de ambiente relevantes (não são bugs de produto):

- **Reports REST não honra dev-bypass:** `src/app/api/v1/reports/[type]/route.ts` chama
  `requireOfficeStaff()` (Clerk) diretamente, sem o `resolveContext`/`isDevAuthBypassEnabled` do
  `restHandler`. Via headers de dev retorna `400 UNAUTHORIZED` antes da lógica. Sugestão (opcional, se
  quiserem cobertura E2E de relatório via bypass): espelhar o `resolveContext` no handler de relatório.
- **Dev-bypass fixa `plan:"free"`** (`devContextFrom` em `rest.ts`): caminhos Pro (Team/Billing) são
  inatingíveis via bypass; apenas os gates negativos (free → FORBIDDEN) foram validados.
- **Nuance PUT cross-tenant** (OBR-05/PGR-09/RISK-08): retorna `422 FK_NOT_FOUND` em vez de `404`
  quando o tenant atuante é vazio, porque a asserção de FK roda antes do lookup. Isolamento mantido;
  difere só o código. Não é FAIL — deferido à rodada de 2º tenant real.

## 5. Itens para a rodada de DB / infra do maestro

- **§15 Documentos/Pastas/Jobs (26 casos):** validação de RLS/isolamento, uniques, RESTRICT, CHECKs e
  claim de fila (`FOR UPDATE SKIP LOCKED`, stale claim, attempts) — cobertos por testes de integração
  em Postgres efêmero (`documents-model.test.ts`, `documents-isolation.test.ts`,
  `folders-model.test.ts`, `jobs-claim.test.ts`) + unit (`validity.test.ts`).
- **Isolamento cross-tenant "A vs B" real:** esta campanha usou `org_qa_nonexistent` (tenant vazio);
  a prova de não-vazamento entre dois tenants **populados** e casos como OS-06 (numeração por tenant)
  pedem um 2º tenant real no banco.
- **Relatórios (REL-01..04):** exigem sessão Clerk (handler sem dev-bypass) + Gotenberg em execução.
- **Team Pro / Billing (TEAM-03..06, BILL-01/04/05/06):** exigem plano Pro com Clerk org e/ou webhook
  Stripe assinado (signing secret).
- **Admin global (ADM-01..05):** exigem aplicar `0018_user_is_master` e testar via Server Action
  (`masterAction`) — não há REST v1.
- **IA happy-path (AUD-06, IA-01/02/05/07/08 e afins):** exigem chave Anthropic válida (ou mock) para
  validar o caminho de sucesso; sem chave, só a degradação `502 AI_UNAVAILABLE` foi confirmada.
- **Resíduo de fixtures não-deletável via API** (marcado `QA-TEST`, seguro para purge SQL): OS em
  estado terminal/assinada e sua `signature_request`/capture; action-plans terminais; risk-audits (sem
  rota DELETE); eventos/lotes eSocial (sem rota DELETE).

## 6. Totais gerais

- **Seções com contagem exata (§10–§15):** 146 PASS · 1 FAIL · 70 BLOCKED (217 casos).
- **Seções §1–§9:** 0 FAIL confirmado em todas.
- **FAILs de produto na campanha inteira:** 5 encontrados → **5 corrigidos e reverificados** →
  **0 FAIL em aberto**.
  1. BUG#1 (§4) epi-catalog REST mirror — corrigido.
  2. BUG#2 (§8) anthropic.ts try/catch — corrigido.
  3. BUG#3 (§8) IA-06 `ai_usage_events` ausente — corrigido (reconciliação de schema de dev).
  4. BUG#4 (§13) register `gesId` não-uuid → 500 — corrigido.
  5. BUG#5 (§13) QA-PSI-08 transição de status inválida — corrigido.
- **Cobertura:** superfície automatizável via REST dev-bypass + Playwright (rotas de token)
  esgotada. O restante é BLOCKED por ausência de superfície (modelo puro / Server Action-only),
  infra externa (Clerk / Gotenberg / Stripe / LLM), 2º tenant real, órfã `0018_user_is_master`, ou
  validação de integração DB — tudo roteado à rodada de DB/infra do maestro.
