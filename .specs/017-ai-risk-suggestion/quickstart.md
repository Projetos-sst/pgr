# Quickstart — Validação: Sugestão de riscos assistida por IA

Guia de validação ponta a ponta. Detalhes de dados/contratos em [data-model.md](./data-model.md),
[contracts/server-actions.md](./contracts/server-actions.md), [contracts/rest-api.md](./contracts/rest-api.md).

## Pré-requisitos

- `npm install` (o provedor é chamado por `fetch`, sem SDK).
- `.env.local`: `OPENROUTER_API_KEY=<chave>` e opcionalmente `AI_SUGGESTION_MODEL` (default `minimax/minimax-m3:free`).
- Migration `0015_ai_usage_events` aplicada (`npm run db:migrate` — conexão owner).
- Para integração: `INTEGRATION_DATABASE_URL` (+ `INTEGRATION_APP_RUNTIME_URL`) → **Postgres efêmero**.

## Cenários de validação

### 1. Gates automatizados (sem chave real — LLM mockado)

```bash
npm run typecheck
npm run lint
npm run test                # unit: schema/parse/prompt-sem-PII/cota
npm run test:integration    # Server Actions vs Postgres efêmero; LLM mockado
npm run build
npm run db:generate         # deve reportar "No schema changes"
```

Esperado: tudo verde; a suíte `pgr/ai-risk-suggestion` cobre suggest (happy/cross-tenant/cota/pro/
FORBIDDEN) e accept (happy/cross-tenant/VALIDATION). Sem `INTEGRATION_*`, a suíte de integração fica
`skip` (não falha).

### 2. Fluxo US1 na UI (com chave real)

1. Abrir um GES com processo/ambiente/funções bem descritos → `/ges/[id]/edit`.
2. Clicar **"Sugerir Riscos com IA"** → aparece lista estruturada (agente, perigo, descrição, fontes).
3. Selecionar alguns itens → confirmar → apenas os selecionados aparecem no inventário como **rascunho**.
4. Conferir que **nada** foi adicionado sem seleção.
5. Repetir até exceder a cota do plano free (20/mês) → botão bloqueado / `QUOTA_EXCEEDED`.

### 3. Fluxo REST (Postman/cURL)

```bash
# suggest (200)
curl -X POST "$baseUrl/api/v1/ges/$gesId/risk-suggestions" \
  -H "x-dev-tenant: $devTenant" -H "x-dev-role: owner"
# accept (201)
curl -X POST "$baseUrl/api/v1/ges/$gesId/risk-suggestions/accept" \
  -H "x-dev-tenant: $devTenant" -H "x-dev-role: owner" \
  -H "content-type: application/json" \
  -d '{"suggestions":[{"agentType":"physical","description":"Ruído contínuo"}]}'
```

### 4. Edge cases a conferir

- GES vago → "nenhuma sugestão"; GES de outra org → `FK_NOT_FOUND` (LLM não chamado); LLM fora →
  `AI_UNAVAILABLE` (502) com GES intacto; item com agente inválido → item descartado, lote preservado.

### 5. Privacidade

- Confirmar (teste unit do prompt + inspeção de `fetchGesRiskContext`) que **nenhum** dado de
  `employees` (nome/CPF) entra no payload enviado ao LLM.

## US2 — Dicas de preenchimento

- Abrir formulário de GES e de risco → dicas "💡 Dica da IA:" nos campos críticos (processo/ambiente/
  funções; fontes/propagação/possíveis lesões). Não depende de chamada externa.
