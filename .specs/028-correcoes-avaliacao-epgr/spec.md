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

## Tarefas (status final)

1. ✅ **Migration única do Grupo A** (`0031_epgr_correcoes_grupo_a.sql`) — 4 colunas + 1 enum.
   `#45` não precisou de CHECK no banco (`related_entity_type` é texto livre por design — ver
   ruling no commit do schema).
2. ✅ **#22** — saldo inicial no cadastro de EPI, via movimentação `purchase` (não escreve
   `balance` direto — preserva a trilha de auditoria).
3. ✅ **#2** — máscara + validação de CNPJ (+ máscara de CPF em Funcionários/Perfil, pedido à
   parte na mesma sessão).
4. ✅ **#18** — botão "Emitir Ordem de Serviço" no GES.
5. ✅ **#50** — ação esperada por nível de risco.
6. ✅ **#28** — filtros de categoria/validade no relatório de estoque (filtro de lote confirmado
   fora, depende da #23).
7. ✅ **#34** — alerta de validade de CA (espelha `trainingsExpired`/`trainingsDueSoon`).
8. ⚠️ **#51 + #42 — só #51 entregue.** A ponte `control_measure → action_plan` está completa
   (origem polimórfica nova `control_measure`, upsert idempotente, cancela ao desmarcar
   `applicable`). **A regra de status do #42 (maintain/introduced/improved por nível de risco +
   garantir entrada de plano para todo risco do inventário) ficou fora**: exigiria classificar o
   risco via bandas de metodologia (plumbing cross-domínio, `risk_assessments` → `classify()`) e
   decidir que conteúdo de 5W2H entra num plano "placeholder" pra risco trivial sem ação real —
   isso é decisão de produto, não só engenharia. A coluna `control_measures.status` (migration 0031) existe mas fica sem uso até essa decisão ser tomada.
9. ✅ **#46** — arquivar revisão do PGR (Server Action + REST mirror + UI + docs/Postman).
10. ✅ **#45** — anexos habilitados em GES e Risco. `responsible_technician` fica sem consumidor
    de UI — não existe cadastro de Responsável Técnico ainda (issue #36, fora de escopo).
11. ✅ **#44** — proposta técnica postada como comentário na issue (sem código), com estimativa de
    esforço e por que não implementar já.

**Pendências que sobrevivem ao lote:**

- A regra de status do #42 (ver Tarefa 8) — precisa de decisão de produto antes de codar.
- Nenhum teste de integração deste lote rodou de fato (sem Postgres efêmero neste ambiente) — só
  foram escritos seguindo o padrão do projeto. Rodar `npm run test:integration` antes do merge.
- `/documents` com filtro `relatedEntityType=ges|risk` não tem um rótulo de "banner" dedicado como
  o de PGR (`PGR {id}`) — cosmético, o filtro funciona, só a legenda da tela fica genérica.

Branch: `fix/correcoes-avaliacao-epgr`. Cada tarefa = 1 commit próprio, revisado pelo orquestrador
antes de commitar (subagent-driven-development enxuto: sem worktree/ledger formal, review feita
pelo próprio orquestrador em vez de um segundo subagent revisor).
