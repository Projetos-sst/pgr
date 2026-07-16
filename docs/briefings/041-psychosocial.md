# Briefing — Fase 09: Riscos Psicossociais

PR única consolidando as 4 fatias da Fase 09 (issues #94, #97, #101, #102), no mesmo estilo da Fase 08.
Base: `feature/fase-08-unified` (empilhada para a migration chainar `0021` e herdar o `.gitattributes`
LF). **Migration nova `0021_psychosocial`.**

## Módulo

Mapeamento de riscos psicossociais via **campanhas + questionário anônimo** (NR-01/GRO), fechando o
ciclo: criar campanha → montar questionário → coletar respostas anônimas por link → derivar riscos →
registrar no inventário/PGR.

## 01 (#94) — Modelo de dados

Migration `0021_psychosocial`: 2 enums (`psychosocial_campaign_status`
`draft|active|closed|archived`; `psychosocial_question_type` `likert|multiple_choice|free_text`) + 5
tabelas tenant-isoladas (RLS `app_runtime`): `psychosocial_campaigns`, `psychosocial_questions`
(sub-entidade), `psychosocial_responses` (submissão anônima, `token` uuid único), `psychosocial_answers`
(1 por pergunta), `psychosocial_risks` (fator derivado, vinculável a `risks`). `public_token` único
para o link; **policy de capability** `psychosocial_campaigns_token_read` p/ leitura pública.

## 02 (#97) — CRUD de campanha + perguntas

- Campanha: `list` (paginada, filtro obra/status), `getById` (+ perguntas), `create`, `update`,
  `setStatus` (transições; **não ativa sem perguntas** → `422 VALIDATION`), `delete` (cascata).
- Perguntas (sub-entidade): `add` (position ao fim), `update`, `remove` (bloqueia se ativa e já
  respondida → `409 IN_USE`), `reorder` (swap de position).
- Empresa/obra cross-tenant → `422 FK_NOT_FOUND`. UI: `/psicossocial/campanhas` (lista) + **editor por
  abas** (Informações · Perguntas · Respostas · Dashboard · Riscos · Conclusão) via `?tab=`.

## 03 (#101) — Questionário público por token

- Rota pública anônima `/(public)/responderpsico/[campaignId]/[token]` (adicionada ao `proxy.ts`;
  no-store). Resolve a campanha pela **policy de capability** do token (sem sessão), valida
  **ativa + dentro do período**; renderiza cabeçalho com cor do tema/descrição + perguntas por tipo.
- `submitPsychosocialResponse` (Server Action pública): grava resposta **sem vínculo nominal**;
  `token` de resposta é UUID único (anônimo). Campanha fechada/expirada/inválida → mensagem amigável.
- Helper `withPsychosocialToken` (espelha `withSignatureToken`).

## 04 (#102) — Dashboard + derivação

- `getCampaignStats`: média Likert por pergunta + contagem de participação (sem identificar
  respondentes).
- Derivação **pura** `deriveRisks(stats, threshold)` (função testável): Likert acima do limiar vira
  fator com nível 1–4 (`classifyLevel`). `deriveRisksForCampaign` faz **upsert idempotente** em
  `psychosocial_risks`.
- `registerRiskInPgr(psychoRiskId, gesId)`: cria `risks` (agente **`psychosocial`**) no GES da obra e
  vincula (`riskId`); idempotente. Conclusão: `concludeCampaign` (status `closed`).

## Superfície (mandato de 4 partes)

Server Actions (`officeAction`) + REST `/api/v1/psychosocial-campaigns/**` (+ status/questions/stats/
risks/register/conclude) + `api-design.md` + Postman ("Psicossocial (campanhas)"). A submissão pública
é Server-Action-only (a rota pública é a superfície testável), espelhando as assinaturas.

## Erros

Reusa `VALIDATION`/`DUPLICATE`/`FK_NOT_FOUND`/`IN_USE`/`NOT_FOUND`/`FORBIDDEN`. Novo helper de erro
`ValidationError` (código `VALIDATION`, 422).

## Testes

- **Unit**: schemas (campanha/pergunta/resposta), regras de status, **derivação** (`classifyLevel`,
  `deriveRisks`), `parseOptions`, projeção.
- **Integração** (Postgres efêmero): CRUD + isolamento cross-tenant, FK_NOT_FOUND empresa, ativação sem
  perguntas, reorder, **rota pública** (token válido/inválido, submissão anônima, campanha fechada),
  **derivação + registro no PGR** na org correta. Migration validada **0000→0021** em banco limpo.
