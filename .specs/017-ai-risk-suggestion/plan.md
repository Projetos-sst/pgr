# Implementation Plan: Sugestão de riscos assistida por IA

**Branch**: `feature/ai-risk-suggestion` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/017-ai-risk-suggestion/spec.md`

> **Nota**: fatia já implementada (as-built). Este plano documenta a arquitetura efetiva e serve de
> base para `/speckit-tasks`. Registro de implementação em
> [docs/briefings/implementacao-ai-risk-suggestion.md](../../docs/briefings/implementacao-ai-risk-suggestion.md);
> análise em [docs/briefings/briefing-ai-risk-suggestion.md](../../docs/briefings/briefing-ai-risk-suggestion.md).

## Summary

No inventário de riscos de um GES, o gestor de SST aciona "Sugerir Riscos com IA": o sistema monta o
**contexto não-PII do GES** (processo, ambiente, títulos das funções expostas), consulta um LLM
(Anthropic/Claude) com **saída estruturada** (tool use validado por Zod) e devolve uma lista de riscos
para **revisão e aceite**. Os itens aprovados viram **rascunho** na tabela `risks` já existente (reuso de
`createRisk` — zero migration de risco). Uma cota mensal por organização (derivada de uma tabela nova
append-only `ai_usage_events`) faz o rate limiting por plano. Complementarmente, dicas de preenchimento
estáticas orientadas à NR-01 são exibidas nos campos críticos dos formulários de GES e de risco.

A regra vive **uma vez** num núcleo compartilhado consumido pela Server Action (`officeAction`) e pelo
espelho REST (`restHandler`); o isolamento (pertencimento do GES ao tenant) e a cota são verificados
**antes** de qualquer chamada externa.

## Technical Context

**Language/Version**: TypeScript strict (Next.js 16.2.6 App Router, React 19.2.4)

**Primary Dependencies**: `@anthropic-ai/sdk` (novo), Drizzle ORM + `postgres` (postgres-js), Zod v4,
Clerk (sessão/identidade). Sem `signature_pad`/`qrcode` (não aplicável a esta fatia).

**Storage**: Supabase PostgreSQL. Reuso de `risks` (migration 0012) para a persistência das sugestões
aceitas; **1 tabela nova** `ai_usage_events` (contador de cota).

**Testing**: Jest — unit (jsdom) para domínio/prompt/cota; integração (node) de Server Actions contra
**Postgres efêmero** (`INTEGRATION_*`), com o **LLM mockado** (nenhuma chamada externa nos testes).

**Target Platform**: Vercel serverless (Route Handlers + Server Actions).

**Project Type**: Web app fullstack Next.js (não há backend separado).

**Performance Goals**: chamada de sugestão é **interativa e única** (não streaming, não lote); UI mostra
estado de carregamento. Deve caber no orçamento de tempo do serverless.

**Constraints**: chave `ANTHROPIC_API_KEY` **somente no servidor**; **nenhum PII** (employees/CPF)
enviado ao LLM (só campos do GES + títulos de função); falha de IA **não bloqueia** o cadastro do GES;
tenant sempre da sessão (`orgs.id`), nunca de input do cliente.

**Scale/Scope**: cota do plano free = 20 pedidos/mês/org; pro ilimitado. Contexto do GES de tamanho
modesto (poucos KB de texto). Sem processamento em lote.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                 | Status             | Observação                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Isolamento Multi-Tenant**            | ✅ PASS            | `ai_usage_events` tem `org_id` + RLS `app_runtime` + `withOrg`. `fetchGesRiskContext`/`createRisk` escopados por `withOrg` + RLS; GES cross-tenant → `FK_NOT_FOUND` **antes** do LLM. Tenant da sessão; nunca do cliente. Contexto ao LLM exclui `employees`.  |
| **II. Stack Fixa e Simplicidade (YAGNI)** | ✅ PASS            | **Resolvido pela emenda 1.3.0** (Princípio II autoriza provedores de LLM sob salvaguardas: chave server-only, zero-PII, cota por tenant, degradação não-bloqueante — todas atendidas por esta fatia). Sem outra infra nova (sem fila/microserviço/novo banco). |
| **III. Fatias Verticais**                 | ✅ PASS            | Fatia independente (1 issue → 1 branch → 1 spec); US1 (P1) é MVP demonstrável isolado; US2 (P2) complementar.                                                                                                                                                  |
| **IV. Operações Pesadas Assíncronas**     | ✅ PASS (com nota) | A sugestão é **uma** chamada interativa (não lote/massa) com loading; não é operação pesada no sentido da cláusula (geração PDF em lote, notificações em massa). Streaming/lote ficam fora de escopo.                                                          |
| **V. Segurança e Integridade**            | ✅ PASS            | Zod valida entradas (ação e REST) antes do banco; `ai_usage_events` com FK/RLS; segredo só em env; TS strict; `AI_UNAVAILABLE` não vaza detalhe do provedor.                                                                                                   |
| **Testes (Gate de qualidade)**            | ✅ PASS            | Unit + integração; usa a **exceção de Postgres efêmero** (RLS/policies) prevista no Princípio de testes; LLM mockado mantém determinismo.                                                                                                                      |

**Resultado**: ✅ todos os princípios passam. O gate do Princípio II (serviço externo pago) foi
**resolvido pela emenda formal 1.3.0** (2026-07-08), que autoriza provedores de LLM sob salvaguardas.
Histórico do gate mantido em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
.specs/017-ai-risk-suggestion/
├── plan.md              # Este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (server-actions.md, rest-api.md)
├── checklists/
│   └── requirements.md  # do /speckit-specify
└── tasks.md             # /speckit-tasks (ainda não criado)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domains/pgr/
│   │   ├── ai-risk-suggestion.ts        # schemas Zod, parseModelSuggestions, toRiskValuesFromSuggestion
│   │   └── field-hints.ts               # GES_FIELD_HINTS / RISK_FIELD_HINTS (NR-01)
│   ├── integrations/ai/
│   │   ├── config.ts                    # server-only: getAiModel(), requireAnthropicApiKey()
│   │   ├── prompt.ts                    # puro: buildRiskSuggestionPrompt/buildSuggestionTool/extract
│   │   └── anthropic.ts                 # server-only: requestRiskSuggestions (ÚNICO ponto de rede)
│   ├── db/
│   │   ├── schema/ai-usage-events.ts    # tabela nova (cota) + RLS
│   │   ├── migrations/0014_ai_usage_events.sql
│   │   └── repositories/ai-risk-suggestion.ts  # fetchGesRiskContext / count / record
│   ├── server/
│   │   ├── pgr/ai-risk-suggestion-core.ts      # runSuggestRisks / runAcceptSuggestedRisks
│   │   └── actions/pgr/ai-risk-suggestion.ts   # officeAction wrappers
│   ├── errors/ai-unavailable-error.ts          # AI_UNAVAILABLE (502)
│   └── tenant/plan.ts                          # FREE_AI_SUGGESTION_MONTHLY_QUOTA, isAiSuggestionAvailable
└── app/
    ├── (protected)/
    │   ├── _ui/field-hint.tsx
    │   ├── ges/[id]/_components/suggest-risks-section.tsx   # botão + modal de revisão
    │   ├── ges/[id]/edit/page.tsx (monta a seção)
    │   ├── ges/_components/ges-form.tsx (dicas)
    │   └── risks/_components/risk-form.tsx (dicas)
    └── api/v1/ges/[id]/risk-suggestions/
        ├── route.ts            # POST suggest (200)
        └── accept/route.ts     # POST accept (201)
```

**Structure Decision**: segue a arquitetura em camadas do repo (page → client → Server Action/REST →
núcleo compartilhado → repositório/integração → Drizzle). A integração LLM isola o ponto de rede em
`integrations/ai/anthropic.ts`; funções puras/testáveis (prompt/parse) ficam fora dos arquivos
`server-only`.

## Complexity Tracking

| Violation                                                    | Why Needed                                                                                          | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Serviço externo pago novo — LLM Anthropic** (Princípio II) | A feature É a assistência por IA: sem um LLM não há sugestão de riscos. É o valor central da issue. | Não há alternativa "sem serviço externo" que entregue sugestão de riscos por IA. Regras heurísticas locais não cobrem o espaço de riscos ocupacionais por contexto de GES. **Resolvido**: emenda formal **1.3.0** (2026-07-08) autoriza provedores de LLM como infra permitida sob salvaguardas (chave server-only, zero-PII, cota por plano, falha não-bloqueante). |
| **Tabela nova `ai_usage_events`**                            | Rate limiting por org exige contador **persistido** (serverless não conta em memória).              | Gate só por plano não limita uso real por mês; contador em memória não sobrevive a cold start. Espelha o padrão já aceito da assinatura digital (contar linhas do mês corrente) — sem cron nem contador materializado.                                                                                                                                               |
