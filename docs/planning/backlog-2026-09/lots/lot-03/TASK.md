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

- [x] `git fetch origin --prune && git rebase origin/develop` (a branch nasceu em `25ade4d`)
- [x] Conferir a última migration real antes de gerar qualquer coisa (era `0050`)
- [x] Conferir PRs concorrentes tocando `pgr-consolidated.ts`, `pgr-pdf-template.ts`, `documents` ou `epis`
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
- [ ] `getPgrConsolidated` passa a trazer a avaliação ergonômica vigente

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

- [ ] `PgrPdfSectionKey` ganha a seção NR-17 na ordem correta
- [ ] Tabela por GES: risco, data, responsável, seis dimensões e observações
- [ ] Bloco agregado da campanha psicossocial
- [ ] Risco sem avaliação → "sem avaliação ergonômica registrada"; GES sem nenhuma → linha única
- [ ] Sumário e numeração das seções acompanham
- [ ] Unit do template: ordem, estado honesto, ausência de escore inventado
- [ ] Integração: rota de PDF e `pdf-batch-core`
- [ ] PDF real conferido pelos **dois** chamadores
- [ ] Comentar e **fechar a #47**

## 10. #48 — Tipos NR-18

- [ ] `domains/documents/nr18.ts` com a lista fechada dos tipos do 18.4.3 e rótulos
- [ ] Tipos entram como sugestões de `doc_type` no upload vindo do PGR
- [ ] N/A — nenhuma migration (o GED já cobre arquivo, versão, vínculo e tipo)

## 11. #48 — Documents/GED

- [ ] Painel "Documentos complementares (NR-18)" na aba Documentos do PGR
- [ ] Checklist por tipo (anexado/faltando) com atalho de anexar, **informativo** (não bloqueia)
- [ ] Exibido quando a unidade do PGR é `site`; nas demais, nada é mostrado
- [ ] Versionamento (#56) e vínculo preservados — nova versão não some do checklist

## 12. #48 — EPI derivado

- [ ] Consulta derivada PGR → GES → riscos → `epi_risk` → `epi_catalog`, deduplicada por EPI
- [ ] Colunas: nome, CA, validade do CA, fabricante, norma, material/tamanho, vida útil, riscos atendidos
- [ ] Badge de CA vencido/a vencer usando a validade real
- [ ] Nenhuma digitação: a fonte é o cadastro
- [ ] Seção "Relação de EPIs" no PDF

## 13. #48 — UI

- [ ] Painel de checklist e painel da relação no padrão do `data-list`
- [ ] Aviso de que a relação vem do cadastro de EPI
- [ ] Estado vazio: PGR sem GES/EPI indicado

## 14. #48 — Tests

- [ ] Unit: checklist por tipo, relação deduplicada, badge de validade
- [ ] Integração: relação isolada por tenant; documento de outro tenant fora do checklist
- [ ] Unit do template da seção de EPIs

## 15. Visual (obrigatório em toda tela nova ou alterada)

- [ ] Reutilizar `PageHeader` global (com `icon`, `description` e `backHref`)
- [ ] Reutilizar `ListCard` + `ListToolbar` do `data-list`
- [ ] Reutilizar `DataGrid`/`GridHeader`/`GridRow`/`Cell` — nenhuma tabela nova à mão
- [ ] Estender `Cell`/`GridColumn` com `align: "center"` na primitive (não espalhar `text-center`)
- [ ] Centralizar cabeçalhos e valores; deixar à esquerda só a coluna descritiva principal
- [ ] Badges semânticos com `StatusBadge` e os tons existentes — nenhuma cor hardcoded
- [ ] Formulário no wrapper centralizado de 940px
- [ ] Usar `_ui/form` (sem `max-w-2xl`, sem input solto)
- [ ] Botão Voltar pelo `PageHeader`, na posição padrão
- [ ] Campos agrupados em cartões por tema
- [ ] Ações no rodapé (`FormActions`: primária à direita, cancelar ao lado)
- [ ] `ListFooter` com contagem, paginação e itens por página
- [ ] `EmptyState` nos estados vazios
- [ ] Validar 1440×900
- [ ] Validar 768×1024
- [ ] Validar 375×812
- [ ] Verificar `scrollWidth <= clientWidth` nas três larguras
- [ ] Comparar visualmente com uma tela de referência já aprovada (riscos psicossociais / EPI / GES)

## 16. PDF

- [ ] Gerar pela rota síncrona e conferir o arquivo
- [ ] Gerar pelo worker ("Arquivar no GED") e conferir que sai equivalente
- [ ] Conferir A4: sem overflow, cabeçalho de tabela repetindo, sem linha órfã
- [ ] Nenhuma string fabricada (ponte #51) e nenhum escore inventado

## 17. RLS e cross-tenant

- [ ] Avaliação ergonômica de outro tenant → `NOT_FOUND`
- [ ] Criar avaliação em risco de outro tenant → `FK_NOT_FOUND`
- [ ] Relação de EPIs não inclui EPI de outro tenant
- [ ] Documento de outro tenant não entra no checklist NR-18
- [ ] `client` → `FORBIDDEN` nas ações novas

## 18. Playwright

- [ ] Massa sintética própria em tenant de QA (nunca cliente real)
- [ ] #40: criar, reabrir, editar e excluir avaliação ergonômica
- [ ] #40: risco sem avaliação com estado honesto
- [ ] #47: PDF com a seção NR-17 na ordem
- [ ] #48: anexar documento NR-18 e ver o checklist mudar
- [ ] #48: relação de EPIs refletindo o cadastro
- [ ] Evidências em `validacao_full/040-*` e `validacao_full/048-*` (desktop/tablet/mobile)
- [ ] Console e rede sem erro inesperado
- [ ] Massa removida (dados + Storage) e contagens conferidas

## 19. Walkthrough

- [ ] `WALKTHROUGH.md` do lote com o fluxo real (onde cadastrar, o que aparece no PDF, o que a NR-18 mostra)

## 20. Review

- [ ] `REVIEW.md` com arquivos, migration, decisões, desvios, riscos e dívidas

## 21. QA

- [ ] `QA.md` escrito **antes** da execução e preenchido com o resultado real

## 22. Rebase

- [ ] `git fetch origin --prune && git rebase origin/develop`
- [ ] Migrations revalidadas após o rebase (journal, snapshots, banco do zero)
- [ ] Repetir `check`, integração, build e os fluxos críticos do Playwright

## 23. PR

- [ ] Push da branch e **uma única PR**
- [ ] `Closes #40`, `Closes #47` e `Closes #48` (o que estiver completo)
- [ ] Board: issues entregues → In review; nada marcado como Done sem merge
- [ ] Sem merge automático — merge é do usuário
