# Implementação — Sugestão de riscos por IA (`feature/ai-risk-suggestion`)

Registro do que foi implementado (as-built). Análise/planejamento prévios em
[briefing-ai-risk-suggestion.md](./briefing-ai-risk-suggestion.md). Base: `develop` (`cf0fdcc`,
última migration `0013_risk_methodology`). Idioma: código em inglês, docs em PT-BR.

---

## 1. Escopo entregue

- **US1 — Sugestão de riscos por IA**: botão "Sugerir Riscos com IA" no inventário do GES →
  Server Action consulta o LLM (Anthropic/Claude) com o **contexto não-PII do GES** → devolve riscos
  estruturados → modal de revisão com seleção → aceitos viram **rascunho** em `risks` (reusa `createRisk`).
- **US2 — Dicas de preenchimento da IA**: helpers estáticos (`💡 Dica da IA:`) nos campos críticos dos
  formulários de GES e de risco.
- **Rate limiting por organização**: cota mensal do plano (`free` limitado, `pro` ilimitado), espelhando
  a cota de assinaturas.

Decisões-chave (todas do briefing): **saída estruturada única** (tool use, não streaming); **dicas
estáticas** (não dinâmicas); **reuso de `risks`** para persistência; contexto do GES **sem `employees`**.

## 2. Arquitetura (camadas, espelhando o repo)

`page → SuggestRisksSection (client) → Server Action (officeAction) ─┐`
`REST route (restHandler) ──────────────────────────────────────────┴→ core compartilhado → repos + integração IA`

- **Núcleo compartilhado** `src/shared/server/pgr/ai-risk-suggestion-core.ts` — a regra
  (`runSuggestRisks`/`runAcceptSuggestedRisks`) vive **uma vez** e é consumida pela Server Action e pelo
  mirror REST (regra das 4 partes: não reimplementada nas duas superfícies).
- **Isolamento**: `fetchGesRiskContext` e `createRisk` são escopados por `withOrg` + RLS; GES de outra org
  é invisível → `FK_NOT_FOUND` **antes** de qualquer chamada externa. Tenant sempre da sessão.

## 3. Arquivos

**Dados (1 migration nova — additiva):**

- `db/schema/ai-usage-events.ts` — tabela append-only `ai_usage_events` (`org_id`, `kind`, `created_at`)
  - RLS `ai_usage_events_isolation`. Só para a **cota** (contagem no mês corrente), espelhando como a
    assinatura conta `signature_requests`. Export no `schema/index.ts`.
- `db/migrations/0014_ai_usage_events.sql` (+ snapshot/journal) — `CREATE TABLE` + RLS + policy + índices
  - `GRANT SELECT, INSERT` manual (least-privilege). Validado: `db:generate` → "No schema changes".

**Domínio (puro):**

- `domains/pgr/ai-risk-suggestion.ts` — `suggestedRiskSchema` (subconjunto de `risks`), `GesRiskContext`,
  `parseModelSuggestions` (valida item-a-item, descarta inválidos, teto `MAX_SUGGESTIONS`),
  `toRiskValuesFromSuggestion` (sugestão → rascunho via `riskInputSchema`), `AI_RISK_SUGGESTION_KIND`.
- `domains/pgr/field-hints.ts` — `GES_FIELD_HINTS` / `RISK_FIELD_HINTS` (constantes NR-01).

**Integração IA (Anthropic SDK):**

- `integrations/ai/config.ts` (server-only) — `getAiModel()` (default `claude-opus-4-8`),
  `requireAnthropicApiKey()` (ausente → `AI_UNAVAILABLE`).
- `integrations/ai/prompt.ts` (puro/testável) — `buildRiskSuggestionPrompt` (só campos do GES),
  `buildSuggestionTool` (tool use = JSON estruturado), `extractSuggestionsFromContent`.
- `integrations/ai/anthropic.ts` (server-only) — `requestRiskSuggestions`: **único ponto de rede**;
  `client.messages.create` com `tool_choice` forçado; qualquer falha → `AiUnavailableError`.

**Repos / core / actions / REST:**

- `db/repositories/ai-risk-suggestion.ts` — `fetchGesRiskContext` (isolamento), `countAiUsageInCurrentMonth`,
  `recordAiUsage`.
- `server/pgr/ai-risk-suggestion-core.ts` — orquestração compartilhada.
- `server/actions/pgr/ai-risk-suggestion.ts` — `suggestRisks`, `acceptSuggestedRisks` (`officeAction`, `audit`).
- `app/api/v1/ges/[id]/risk-suggestions/route.ts` (POST suggest, 200) +
  `.../accept/route.ts` (POST accept, 201).

**Erros/plano:**

- `errors/ai-unavailable-error.ts` (`AI_UNAVAILABLE` → 502) + mapa em `api/rest.ts`.
- `tenant/plan.ts` — `FREE_AI_SUGGESTION_MONTHLY_QUOTA = 20`, `isAiSuggestionAvailable`.

**UI:**

- `app/(protected)/_ui/field-hint.tsx` — componente `FieldHint`.
- `app/(protected)/ges/[id]/_components/suggest-risks-section.tsx` — botão + modal de revisão (checkbox,
  loading, empty/erro), montado em `ges/[id]/edit/page.tsx`.
- Dicas ligadas em `ges-form.tsx`, `manage-functions.tsx` e `risks/_components/risk-form.tsx`.

**Config:** `@anthropic-ai/sdk@^0.110` (dependência nova) + `ANTHROPIC_API_KEY`/`AI_SUGGESTION_MODEL`
no `.env.example`.

## 4. Contrato de erros

| Situação                            | Código           | HTTP |
| ----------------------------------- | ---------------- | ---- |
| GES de outra org (suggest/accept)   | `FK_NOT_FOUND`   | 422  |
| Cota mensal do plano free estourada | `QUOTA_EXCEEDED` | 402  |
| Falha/timeout/chave ausente do LLM  | `AI_UNAVAILABLE` | 502  |
| `accept` com lista vazia/inválida   | `VALIDATION`     | 422  |
| Papel `client`                      | `FORBIDDEN`      | 403  |

## 5. Fluxo `suggestRisks` (ordem importa)

gate de papel (`officeAction`) → **pertencimento do GES ao tenant** → **cota** (`count` no mês) →
**LLM** → **registra uso** (`ai_usage_events`) → retorna sugestões. Cross-tenant e cota estourada
abortam **antes** da chamada externa (comprovado nos testes de integração: o mock do LLM **não** é chamado).

## 6. Privacidade / segurança

- Chave Anthropic **só no servidor** (`requireAnthropicApiKey`); nunca exposta ao cliente.
- Contexto enviado ao LLM = campos descritivos do GES + **títulos** de função. `employees` (nome/CPF)
  **nunca** entram — garantido pela query (`fetchGesRiskContext` não lê `employees`) e por teste unit
  do prompt.
- Falha de IA **não bloqueia** o cadastro (a sugestão é auxiliar).

## 7. Testes

- **Unit** (jsdom, 21 casos): `parseModelSuggestions`/schema/`toRiskValuesFromSuggestion`;
  `buildRiskSuggestionPrompt` (inclui campos do GES, **sem PII**) + `extractSuggestionsFromContent` +
  tool; `isAiSuggestionAvailable`.
- **Integração** (`pgr/ai-risk-suggestion.test.ts`, Postgres efêmero `INTEGRATION_*`, **LLM mockado**):
  suggest happy + registra 1 uso; cross-tenant → `FK_NOT_FOUND` (LLM não chamado); cota → `QUOTA_EXCEEDED`
  (LLM não chamado); `pro` ignora cota; `FORBIDDEN`; accept persiste rascunhos; accept cross-tenant →
  `FK_NOT_FOUND`; accept vazio → `VALIDATION`. Sem SQLite.

## 8. Gates

`npm run typecheck` ✅ · `npm run lint` ✅ · `npm run test` ✅ **447/447** (was 434) ·
`npm run build` ✅ (rotas `/api/v1/ges/[id]/risk-suggestions(/accept)` compiladas) ·
`db:generate` → "No schema changes" ✅. `format:check` não roda localmente (artefato CRLF do
checkout Windows — `core.autocrlf=true`; passa no CI Linux).

## 9. Follow-ups

- **Migration `0014`**: `develop` está em `0013`; a branch paralela `epi-risk-link` também reivindica
  `0014`. Se ela mesclar primeiro, **renumerar esta para `0015`** no rebase (procedimento padrão:
  renomear `.sql`, `tag` no `_journal.json`, `prevId` do snapshot; validar com `db:generate`).
- **T-env**: rodar `npm run test:integration` contra Postgres efêmero (as suítes de `ai-risk-suggestion`
  ficam `skip` sem `INTEGRATION_*`).
- **Validação com chave real**: exercitar o happy path do LLM ponta a ponta com `ANTHROPIC_API_KEY` (o
  caminho de rede é coberto por mock nos testes; a chamada real depende de credencial).
