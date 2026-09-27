# Lote 3 — Task

Checklist **vivo** da implementação do lote. Q1–Q4 decididas em 27/09/2026 ([AUDIT.md](AUDIT.md)) e
execução autorizada. Tudo numa branch só (`feature/lot-03-nr17-nr18-pgr`), uma PR no fim. Um item só
vira `[x]` depois de implementado **e** verificado.

## 0. Decisões (pré-requisito)

- [x] Q1 — **tabela dedicada `ergonomic_evaluations`** (1:N por risco)
- [x] Q2 — **adequação (enum) + observação** por dimensão; sem escala, sem score, sem conclusão geral
- [x] Q3 — **campanha psicossocial agregada opcional**; nunca escore COPSOQ
- [x] Q4 — **relação de EPIs na tela E no PDF**
- [x] Respostas registradas no AUDIT e no PLAN

## 1. Preparação

- [x] `git fetch origin --prune` — `develop` não andou desde `25ade4d`; rebase desnecessário no início
- [x] Conferida a última migration real antes de gerar: era `0050`, a nova é `0051`
- [x] Conferir PRs concorrentes tocando `pgr-consolidated.ts`, `pgr-pdf-template.ts`, `documents` ou `epis` — nenhuma
- [x] Mover #40 e #48 para _In progress_ no board

## 2. #40 — Schema

- [x] Enum de adequação das dimensões (`ergonomic_adequacy`)
- [x] Tabela `ergonomic_evaluations` com `org_id`, `risk_id`, dimensões, observações, método,
      responsável, `assessed_at`, notas e timestamps
- [x] `pgPolicy` de isolamento + índices por `org_id` e `risk_id`
- [x] `npm run db:generate`, renomear para o padrão descritivo e acertar o `tag` no journal
- [x] Aplicar em Postgres efêmero e rodar o teste de RLS da tabela nova

## 3. #40 — Domain

- [x] `domains/pgr/ergonomics.ts`: schema Zod de entrada, rótulos das dimensões e da adequação
- [x] Regra pura de "avaliação vigente" (mais recente por `assessed_at`, desempate por `created_at`)
- [x] Nenhuma conclusão global inventada; nenhuma escala criada sem requisito

## 4. #40 — Repository

- [x] `repositories/ergonomic-evaluations.ts` com `withOrg`, `assertRiskInTenant` e `auditedTenantWrite`
- [x] Leitura da vigente por risco, reaproveitada pelo consolidado
- [x] `getPgrConsolidated` passa a trazer a avaliação ergonômica vigente (query em lote)

## 5. #40 — Action/REST

- [x] Server Actions (list, get, getCurrent, create, update, delete) com `officeAction`
- [x] REST `/api/v1/risks/{id}/ergonomic-evaluations` (GET, POST 201)
- [x] REST `/api/v1/ergonomic-evaluations/{id}` (GET, PUT, DELETE 204)
- [x] N/A — `rest-ergonomic-evaluations.test.ts` fica fora do CI pela limitação de harness já
      documentada em `jest.config.ts` (o `NextRequest` do Jest quebra em `resolveContext`); a
      verificação real do REST é por HTTP no QA
- [x] `docs/api/api-design.md` atualizado (recurso, verbos, filtros, erros)
- [x] `docs/api/sst-manager.postman_collection.json` com a pasta do recurso

## 6. #40 — UI

- [x] Seção "Avaliação ergonômica (NR-17)" no detalhe do risco, com vigente em destaque
- [x] Páginas de criar e editar avaliação, no wrapper de 940px
- [x] Campos agrupados por cartão (identificação, aspectos físicos, mentais/organizacionais, observações)
- [x] Atalho "Anexar laudo (AET)" apontando para o upload com vínculo ao risco
- [x] Estado honesto quando não há avaliação

## 7. #40 — Psicossocial/COPSOQ

- [x] Campo de método/instrumento com sugestões (inclui COPSOQ) — **sem** calcular escore
- [x] Vínculo opcional com campanha psicossocial **fechada** do mesmo GES
- [x] Leitura agregada (período, nº de respostas, fatores derivados) — **nunca** resposta individual
- [x] Rótulo no PDF declara que é resultado agregado da campanha, não escore normativo

## 8. #40 — Tests

- [x] Unit: Zod, rótulos, seleção da vigente
- [x] Integração: CRUD, histórico, cross-tenant, `client` → `FORBIDDEN`, RLS da tabela nova
- [x] `npm run check` verde (gate antes de tocar no template) — 141 suítes / 1 330 testes

## 9. #47 — NR-17 no PDF

- [x] `PgrPdfSectionKey` ganha a seção NR-17 na ordem correta
- [x] Tabela por GES: risco, data, responsável, seis dimensões e observações
- [x] Bloco agregado da campanha psicossocial
- [x] Risco sem avaliação → "sem avaliação ergonômica registrada"; GES sem nenhuma → linha única
- [x] Sumário e numeração das seções acompanham
- [x] Unit do template: ordem, estado honesto, ausência de escore inventado
- [x] Integração: rota de PDF e `pdf-batch-core`
- [x] PDF real conferido pelos **dois** chamadores
- [x] N/A nesta branch — a #47 é fechada pelo `Closes #47` da PR; o board vai para _In review_

## 10. #48 — Tipos NR-18

- [x] `domains/documents/nr18.ts` com a lista fechada dos tipos do 18.4.3 e rótulos
- [x] Tipos entram como sugestões de `doc_type` no upload vindo do PGR
- [x] N/A — nenhuma migration na #48 (o GED já cobre arquivo, versão, vínculo e tipo)

## 11. #48 — Documents/GED

- [x] Painel "Documentos complementares (NR-18)" na aba Documentos do PGR
- [x] Checklist por tipo (anexado/faltando) com atalho de anexar, **informativo** (não bloqueia)
- [x] Exibido quando a unidade do PGR é `site`; nas demais, nada é mostrado
- [x] Versionamento (#56) e vínculo preservados — nova versão não some do checklist

## 12. #48 — EPI derivado

- [x] Consulta derivada PGR → GES → riscos → `epi_risk` → `epi_catalog`, deduplicada por EPI
- [x] Colunas: nome, CA, validade do CA, fabricante, norma, material/tamanho, vida útil, riscos atendidos
- [x] Badge de CA vencido/a vencer usando a validade real
- [x] Nenhuma digitação: a fonte é o cadastro
- [x] Seção "Relação de EPIs" no PDF

## 13. #48 — UI

- [x] Painel de checklist e painel da relação no padrão do `data-list`
- [x] Aviso de que a relação vem do cadastro de EPI
- [x] Estado vazio: PGR sem GES/EPI indicado

## 14. #48 — Tests

- [x] Unit: checklist por tipo, relação deduplicada, badge de validade
- [x] Integração: relação isolada por tenant; documento de outro tenant fora do checklist
- [x] Unit do template da seção de EPIs

## 15. Visual (obrigatório em toda tela nova ou alterada)

- [x] Reutilizar `PageHeader` global (com `icon`, `description` e `backHref`)
- [x] Reutilizar `ListCard` + `ListToolbar` do `data-list`
- [x] Reutilizar `DataGrid`/`GridHeader`/`GridRow`/`Cell` — nenhuma tabela nova à mão
- [x] Estender `Cell`/`GridColumn` com `align: "center"` na primitive (não espalhar `text-center`)
- [x] Centralizar cabeçalhos e valores; deixar à esquerda só a coluna descritiva principal
- [x] Badges semânticos com `StatusBadge` e os tons existentes — nenhuma cor hardcoded
- [x] Formulário no wrapper centralizado de 940px
- [x] Usar `_ui/form` (sem `max-w-2xl`, sem input solto)
- [x] Botão Voltar pelo `PageHeader`, na posição padrão
- [x] Campos agrupados em cartões por tema
- [x] Ações no rodapé (`FormActions`: primária à direita, cancelar ao lado)
- [x] `ListFooter` com contagem, paginação e itens por página
- [x] `EmptyState` nos estados vazios
- [x] Validar 1440×900
- [x] Validar 768×1024
- [x] Validar 375×812
- [x] Verificar `scrollWidth <= clientWidth` nas três larguras
- [x] Comparar visualmente com uma tela de referência já aprovada (riscos psicossociais / EPI / GES)

## 16. PDF

- [x] Gerar pela rota síncrona e conferir o arquivo
- [x] Gerar pelo worker ("Arquivar no GED") e conferir que sai equivalente
- [x] Conferir A4: sem overflow, cabeçalho de tabela repetindo, sem linha órfã
- [x] Nenhuma string fabricada (ponte #51) e nenhum escore inventado

## 17. RLS e cross-tenant

- [x] Avaliação ergonômica de outro tenant → `NOT_FOUND`
- [x] Criar avaliação em risco de outro tenant → `FK_NOT_FOUND`
- [x] Relação de EPIs não inclui EPI de outro tenant
- [x] Documento de outro tenant não entra no checklist NR-18
- [x] `client` → `FORBIDDEN` nas ações novas

## 18. Playwright

- [x] Massa sintética própria em tenant de QA (nunca cliente real)
- [x] #40: criar, reabrir, editar e excluir avaliação ergonômica
- [x] #40: risco sem avaliação com estado honesto
- [x] #47: PDF com a seção NR-17 na ordem
- [x] #48: anexar documento NR-18 e ver o checklist mudar
- [x] #48: relação de EPIs refletindo o cadastro
- [x] Evidências em `validacao_full/040-*` e `validacao_full/048-*` (desktop/tablet/mobile)
- [x] Console e rede sem erro inesperado
- [x] Massa removida (dados + Storage) e contagens conferidas — 49 linhas → 0

## 19. Walkthrough

- [x] `WALKTHROUGH.md` do lote com o fluxo real (onde cadastrar, o que aparece no PDF, o que a NR-18 mostra)

## 20. Review

- [x] `REVIEW.md` com arquivos, migration, decisões, desvios, riscos e dívidas

## 21. QA

- [x] `QA.md` escrito **antes** da execução e preenchido com o resultado real

## 22. Rebase

- [x] `git fetch origin --prune && git rebase origin/develop`
- [x] Migrations revalidadas após o rebase (journal, snapshots, banco do zero)
- [x] Repetir `check`, integração, build e os fluxos críticos do Playwright

## 23. PR

- [x] Push da branch e **uma única PR**
- [x] `Closes #40`, `Closes #47` e `Closes #48` — as três completas
- [x] Board: issues entregues → In review; nada marcado como Done sem merge
- [x] Sem merge automático — merge é do usuário

## 24. Fechamento

- [x] Bugs do QA corrigidos na mesma branch e reverificados (4 achados de layout)
- [x] `npm run check`, `npm run test:integration` e `npm run build` verdes depois das correções
- [x] Evidências em `validacao_full/040-nr17-ergonomia/`, `048-nr18-pgr/` e
      `047-pgr-pdf-estrutura/lote-03/` (pasta não versionada, padrão dos lotes anteriores)
- [x] Ambiente devolvido como estava (contêiner do worker religado, `pdf-parse` desinstalado,
      temporários removidos, working tree limpa)

Nenhum item ficou em aberto.
