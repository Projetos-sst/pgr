# Phase 0 — Research: Sugestão de riscos assistida por IA

Consolidação das decisões técnicas (as-built). Formato: Decisão · Justificativa · Alternativas.

## R1. Persistência das sugestões aceitas

- **Decisão**: reusar a tabela `risks` (migration 0012) via `createRisk`. Mapa: agente→`agent_type`
  (enum de 7 grupos), perigo→`hazard`, risco→`description` (NOT NULL), fontes→`sources`. "Rascunho" =
  risco **sem** avaliação (`risk_assessments`) e **sem** controles (`control_measures`).
- **Justificativa**: zero migration de risco; riscos criados por IA ficam indistinguíveis dos manuais
  (mesmas regras/validação); "rascunho" é estado **derivado**, sem flag nem tabela nova.
- **Alternativas**: tabela `ai_suggested_risks` dedicada (rejeitada — duplica modelo e regras);
  coluna `source = 'ai'` em `risks` (rejeitada — YAGNI; não há requisito de distinguir origem).

## R2. Rate limiting por organização

- **Decisão**: tabela nova append-only `ai_usage_events` (`org_id`→orgs cascade, `kind` text,
  `created_at`) + RLS `ai_usage_events_isolation` + `GRANT SELECT, INSERT`. Cota = contagem de linhas
  do **mês corrente** (`created_at >= date_trunc('month', now())`). Free = 20/mês; pro ilimitado.
- **Justificativa**: espelha o padrão já aceito da assinatura digital (cota derivada da leitura, sem
  contador materializado nem cron); serverless não permite contador em memória.
- **Alternativas**: gate só por plano sem contagem real (rejeitada — não limita uso/mês); contador
  materializado + cron de reset (rejeitada — complexidade desnecessária).

## R3. Integração LLM e saída estruturada

- **Decisão**: `@anthropic-ai/sdk`; modelo default `claude-opus-4-8` (configurável via
  `AI_SUGGESTION_MODEL`); **saída estruturada via tool use** com `tool_choice` forçado; validação item
  a item por Zod (`suggestedRiskSchema`, subconjunto de `risks`); itens inválidos são **descartados**,
  com teto `MAX_SUGGESTIONS`. Sem streaming na v1.
- **Justificativa**: tool use é robusto entre versões do SDK e garante JSON parseável; validação Zod
  protege contra alucinação de campos; descartar item (não lote) maximiza aproveitamento.
- **Alternativas**: `output_config.format`/JSON mode (rejeitado — menos portável entre versões);
  streaming (fora de escopo v1); parsing de texto livre (rejeitado — frágil).

## R4. Privacidade / superfície de dados enviada ao LLM

- **Decisão**: o contexto é montado por `fetchGesRiskContext`, que lê **apenas** GES + `ges_job_roles`
  - `job_roles` (títulos de função). **Nunca** lê `employees`. Um teste unit do prompt garante ausência
    de PII no payload. Chave só no servidor (`requireAnthropicApiKey`).
- **Justificativa**: Princípio I + requisito legal do domínio; a garantia é estrutural (a query não tem
  como trazer PII) e não apenas por convenção.
- **Alternativas**: enviar dados de funcionários para "melhor contexto" (rejeitado — viola privacidade
  e não agrega ao levantamento de riscos por GES).

## R5. Isolamento e ordem de verificação

- **Decisão**: em `runSuggestRisks`: gate de papel (`officeAction`) → pertencimento do GES ao tenant
  (`fetchGesRiskContext` via `withOrg`+RLS → `FK_NOT_FOUND` se nulo) → cota (`QUOTA_EXCEEDED`) → LLM →
  registra uso (`ai_usage_events`) → retorna. Cross-tenant e cota estourada **abortam antes** do LLM.
- **Justificativa**: nunca gastar chamada externa (custo/segredo) para pedido inválido; comprovado nos
  testes de integração (mock do LLM não é chamado nesses caminhos).
- **Alternativas**: verificar cota depois do LLM (rejeitado — desperdício e vazamento de contexto).

## R6. Tratamento de falha do LLM

- **Decisão**: qualquer erro/timeout/credencial ausente → `AiUnavailableError` (`AI_UNAVAILABLE` → 502);
  mensagem genérica, sem detalhe do provedor; o cadastro do GES permanece intacto.
- **Justificativa**: a sugestão é auxiliar; não pode bloquear o fluxo principal (Success Criteria).
- **Alternativas**: propagar erro cru do SDK (rejeitado — vaza detalhe e trava a UI).

## R7. Superfície de API (regra das 4 partes)

- **Decisão**: núcleo compartilhado (`ai-risk-suggestion-core.ts`) consumido por Server Action
  (`officeAction`) **e** REST mirror (`restHandler`) — `POST /api/v1/ges/[id]/risk-suggestions` (200) e
  `.../accept` (201); docs em `api-design.md`; requests na coleção Postman.
- **Justificativa**: regra do CLAUDE.md; a lógica vive **uma vez**, não reimplementada nas duas
  superfícies.
- **Alternativas**: só Server Action (rejeitado — quebra a regra de superfície testável via cURL/Postman).

## R8. Dicas de preenchimento

- **Decisão**: constantes estáticas (`GES_FIELD_HINTS`/`RISK_FIELD_HINTS`) renderizadas por
  `<FieldHint>` nos campos críticos.
- **Justificativa**: qualidade/conformidade NR-01 sem custo de LLM nem latência; determinístico.
- **Alternativas**: dicas geradas por LLM (fora de escopo v1 — custo/latência/imprevisibilidade).

## Constituição — item aberto

- **Princípio II (serviço externo pago)**: a introdução do provedor LLM exige **emenda formal**.
  Encaminhamento: emenda MINOR autorizando provedores de LLM como infra permitida, condicionada às
  salvaguardas desta fatia (chave server-only, zero-PII, cota por plano, degradação não-bloqueante).
