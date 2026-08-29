# 028 — Correções da Avaliação do e-PGR (lote de issues parciais)

Spec enxuta (sem cerimônia completa de spec-kit — mesma decisão já tomada nas fatias 024-027):
tarefas de escopo pequeno/médio, já com "onde mexer" mapeado issue a issue, não precisam de
research/data-model/contracts separados. Esta spec + a lista de tarefas abaixo bastam como plano.

## Contexto

`Avaliação do e-Pgr REV01.docx` (cliente) gerou 61 issues no GitHub (`Projetos-sst/pgr` #2-#62).
Uma rodada de subagents já classificou cada uma por status real no código: 12 já estavam
implementadas (fechadas com comentário), 3 eram puro texto/label (corrigidas e fechadas em
`fix/simple-label-corrections`, commit `bf90169`), 26 são features novas ainda não implementadas
(fora de escopo aqui) e **21 estão parcialmente implementadas** — é este último grupo que esta
fatia resolve.

## Escopo (issues incluídas)

Agrupadas por tipo de mudança para minimizar nº de migrations e reaproveitar padrões já existentes
no código (nenhuma dessas precisa de tabela nova — só coluna nova em tabela existente ou lógica).

**Grupo A — campos novos em cadastros existentes (1 migration só, ver Tarefa 1):**
- #26 — `stock_movements.invoiceDate` (data da nota fiscal; já existe `invoiceNumber`).
- #29 — `epi_catalog.material` (falta só este campo; CA/validade/norma já existem).
- #46 — flag ARQUIVAR em `pgr_revisions` (append-only hoje, sem status).
- #42 — enum de status da medida de controle (`maintain|introduced|improved`) em `control_measures`.
- #45 — ampliar o enum fechado `documentRelatedEntityTypeSchema` (hoje só `"pgr"`) para permitir
  anexos em outras entidades do PGR.

**Grupo B — lógica/regra de negócio sobre schema já existente (sem migration):**
- #22 — `createEpiStock` força `balance=0`; deve aceitar saldo inicial informado no cadastro.
- #51 — salvar uma `control_measure` deve gerar/atualizar automaticamente a entrada correspondente
  em `action_plans`.
- #42 (parte de regra, complementa o Grupo A) — nível trivial/tolerável força status `maintain`;
  nível moderado+ exige prazo e responsável; todo risco do inventário deve ter entrada no plano de
  ação.
- #34 — alerta de validade de CA/substituição de EPI, replicando o padrão já usado por
  `trainingsExpired`/`trainingsDueSoon` em `notifications.ts`.
- #50 — mapa de "ação esperada" por nível de risco (Trivial…Intolerável), exibido nos 3 lugares
  onde o nível aparece (GES, Inventário, Plano de Ação).
- #28 — filtros de categoria e validade no relatório/listagem de estoque de EPI (filtro de lote
  fica de fora — depende da #23, fora de escopo).
- #18 — botão "Emitir Ordem de Serviço" na tela de GES, reaproveitando o módulo de OS já pronto.
- #2 — máscara de digitação `XX.XXX.XXX/XXXX-XX` no campo CNPJ + validação de dígito verificador.

**Grupo C — deliverable é documento, não código:**
- #44 — proposta técnica (comentário na issue) de como estender `ai-risk-suggestion-core` para
  sugerir também a classificação de risco, mantendo o fluxo de revisão humana. Não implementar
  agora — é "avaliar viabilidade" por definição da própria issue.

## Fora de escopo (e por quê — cada uma seguirá como fatia própria depois)

- **#3, #10** — integração com base externa (CNAE/IBGE-Concla, CBO). Depende de pesquisar
  viabilidade de uma API pública de terceiro antes de codar; risco de gastar o lote inteiro numa
  única issue de resultado incerto.
- **#33** — assinatura digital na entrega de EPI. Migrar `epi_deliveries` do token bespoke atual
  para a infra genérica de assinatura (fatia 010) é uma migração de dados real, não uma correção
  pontual.
- **#47** — estrutura completa do PDF do PGR. Bloqueada por natureza: depende de NR-09 (#39) e
  NR-17 (#40) existirem primeiro, e essas são 🔴 não implementadas (fora deste lote).
- **#52, #54, #55, #56, #62** — fluxo de Qualidade/GED (elaboração → aprovação → publicação →
  versionamento → regras de negócio). Interdependem entre si e de perfis/permissões (#58, 🔴 não
  implementada, fora deste lote). É um subsistema com RBAC + trilha de auditoria + workflow de
  estados — do tamanho das fatias 023/026/027 anteriores, não de um lote de correções. Recomendo
  virar sua própria fatia `.specs/029-*` com spec/plan dedicados quando entrar na fila.

## Critérios de aceite (consolidado — ver também cada issue individualmente)

- [ ] `npm run check` (lint + typecheck + testes unitários) passando após cada tarefa.
- [ ] Toda tarefa do Grupo B que envolve Server Action/API tem teste de integração (Postgres
      efêmero) cobrindo o fluxo, por política do projeto.
- [ ] Migration única do Grupo A segue o padrão de custom SQL do projeto quando aplicável (nenhuma
      dessas 5 mudanças precisa de GRANT/policy novo — são colunas em tabelas já cobertas por RLS).
- [ ] Nenhuma issue do Grupo C vira código nesta fatia — só comentário/proposta registrada.

## Tarefas

1. **Migration única do Grupo A** (schema + `npm run db:generate` + revisão do SQL gerado) — as 5
   colunas/enum listadas acima, num commit só.
2. **#22** — saldo inicial no cadastro de EPI.
3. **#2** — máscara + validação de CNPJ.
4. **#18** — botão "Emitir Ordem de Serviço" no GES.
5. **#50** — ação esperada por nível de risco.
6. **#28** — filtros de categoria/validade no relatório de estoque.
7. **#34** — alerta de validade de CA.
8. **#51 + #42 (regra)** — ponte `control_measure` → `action_plan` + status da medida por nível de
   risco (mesma área de domínio, um commit só).
9. **#46** — UI de arquivamento de revisão do PGR (a coluna já sai pronta da Tarefa 1).
10. **#45** — habilitar os novos tipos de entidade no formulário de anexos (a coluna/enum já sai
    pronta da Tarefa 1).
11. **#44** — comentário de proposta técnica na issue (sem código).

Cada tarefa acima = 1 dispatch de subagent implementador + revisão do diff pelo orquestrador antes
do commit, seguindo o loop de `subagent-driven-development`. Migrations (Tarefa 1) e tarefas que
tocam regra de negócio cross-tenant usam modelo com mais raciocínio (não haiku); tarefas de
UI/wiring pontual usam o modelo mais barato que resolver.
