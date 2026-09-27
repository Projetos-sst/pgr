# Lote 2 — Task

Checklist operacional de [PLAN.md](PLAN.md). **Nada marcado**: a implementação só começa depois das
respostas de Q1, Q2 e Q3 ([AUDIT.md](AUDIT.md)) e da autorização do usuário.

## 0. Decisões (pré-requisito)

- [ ] Q1 respondida — modelo da avaliação NR-09 (colunas em `risk_assessments` vs. tabela nova)
- [ ] Q2 respondida — conclusão informada vs. calculada
- [ ] Q3 respondida — 5W2H com 5 de 7 (sem migration) ou 7 de 7 (migration em `control_measures`)
- [ ] Respostas registradas no PLAN (seções "Modelo de dados #39" e "Seção 5 — 5W2H")

## 1. Preparação

- [ ] `git fetch origin --prune && git checkout develop && git pull --ff-only origin develop`
- [ ] Conferir a última migration no repositório (era `0048` em 26/09) e **não** reservar número antes
- [ ] Conferir PRs abertas que toquem `pgr-consolidated.ts`, `pgr-pdf-template.ts` ou `schema/risks.ts`
- [ ] Criar `feature/39-nr09-quantitative-evaluation` a partir de `develop`
- [ ] Mover #39 para _In progress_ no board

## 2. #39 — Schema

- [ ] Enum `nr09_conclusion` (`below_limit | above_limit | not_applicable`) em `schema/risks.ts`
- [ ] Colunas em `riskAssessments`: `evaluation_method`, `measured_value`, `measured_unit`,
      `tolerance_limit_value`, `nr09_conclusion`
- [ ] CHECK: valor medido exige unidade e unidade diferente de `qualitative_na`
- [ ] `npm run db:generate` (número só agora) e revisar o SQL gerado
- [ ] Conferir que a migration **não** recria policy/GRANT (herdados) e que o journal ficou coerente
- [ ] Aplicar em Postgres efêmero e rodar o teste de RLS da tabela

## 3. #39 — Domain

- [ ] Campos novos em `riskAssessmentInputSchema` (`domains/pgr/risk-assessment.ts`), todos opcionais
- [ ] Regra pura: quantitativo com valor exige unidade; qualitativo não aceita campos quantitativos
- [ ] `domains/pgr/nr09.ts`: agentes elegíveis (`physical|chemical|biological`), sugestão de conclusão
      (só quando as unidades batem), rótulos pt-BR de método/conclusão
- [ ] Nenhuma regra nova no repositório ou na UI — as três camadas chamam a função pura

## 4. #39 — Repository

- [ ] `repositories/risk-assessments.ts`: persistir e devolver os campos novos (create/update/get/list)
- [ ] Manter o cálculo de `riskLevel`/`result` intocado
- [ ] `getPgrConsolidated`: avaliação vigente passa a trazer método, valor, unidade, LT numérico e
      conclusão

## 5. #39 — Actions/REST

- [ ] Server Actions de avaliação carregando os campos (sem ação nova)
- [ ] REST `POST/GET /api/v1/risks/{id}/assessments` e `GET/PUT/DELETE /api/v1/risk-assessments/{id}`
- [ ] `docs/api/api-design.md` atualizado (campos e regra de validação)
- [ ] `docs/api/sst-manager.postman_collection.json` atualizado nas duas pastas

## 6. #39 — UI

- [ ] Bloco "Avaliação quantitativa (NR-09)" no `assessment-form.tsx`, visível só no critério
      quantitativo
- [ ] Unidade pré-selecionada com a unidade do risco; sugestão de conclusão quando houver os dois
      números
- [ ] Exibir os campos no detalhe do risco e na aba consolidada do PGR
- [ ] Estado honesto para risco quantitativo sem medição

## 7. #39 — Tests

- [ ] Unit: schema Zod (4 casos de validação), sugestão de conclusão, elegibilidade por agente
- [ ] Integração: criar/editar com campos NR-09; CHECK do banco; cross-tenant; `client` → `FORBIDDEN`
- [ ] `npm run check` verde
- [ ] Rebase em `origin/develop` e abrir **PR #1** (fecha #39) — sem merge automático

## 8. #47 — Preparação

- [ ] #39 mergeada em `develop`
- [ ] Criar `feature/47-pgr-pdf-structure` a partir de `develop` atualizada
- [ ] Mover #47 para _In progress_

## 9. #47 — View model (consolidado)

- [ ] `PgrConsolidated.pgr` ganha empresa completa (CNPJ, nome fantasia, CNAE, atividade, grau de
      risco, endereço) e unidade completa (tipo, contrato, endereço, vigência, preposto, título e
      registro profissional)
- [ ] Repositório amplia a query 1 (sem consulta nova; sem N+1)
- [ ] Tipos e testes unitários do consolidado atualizados

## 10. #47 — Seção 1 (Identificação)

- [ ] `PgrPdfSectionKey` ganha `identification`
- [ ] Bloco com Empresa, Unidade/Obra, Responsável técnico (nome, registro, ART) e **Preposto**
      (`manager_name` — `manager_role`)
- [ ] Campo vazio → "não informado"
- [ ] Sumário reflete a seção

## 11. #47 — Seção 2 (NR-01)

- [ ] Inventário passa a imprimir código eSocial, unidade, concentração, LT textual, cobertura do
      plano (#42) e EPIs indicados
- [ ] Layout A4 conferido (tabela não estoura a página)

## 12. #47 — Seção 3 (NR-09)

- [ ] Nova seção `nr09` no template, por GES, só com agentes elegíveis
- [ ] Colunas: agente, descrição, método, resultado + unidade, LT, conclusão, data
- [ ] Risco elegível sem medição → "sem medição"; GES sem risco elegível → linha única explicando
- [ ] Nenhum valor herdado do risco nem da avaliação qualitativa

## 13. #47 — Seção 4 (NR-17)

- [ ] N/A neste lote — `BLOCKED UNTIL #40` (Lote 3). O template **não** ganha a seção vazia.

## 14. #47 — Seção 5 (5W2H)

- [ ] Se **Q3 = B**: migration `action_why`/`action_cost` em `control_measures` + campos no formulário
      de medida + validação
- [ ] Tabela do plano com os elementos disponíveis (O quê, Como, Quem, Quando, Onde e — se Q3 = B —
      Por quê e Quanto), lidos de `control_measures`
- [ ] Título da seção descreve exatamente o que ela contém
- [ ] **Nenhum** dado vindo de `action_plans` / ponte #51

## 15. PDF — verificação dos dois chamadores

- [ ] Gerar pela rota `GET /api/v1/pgr/[id]/pdf` e conferir o arquivo
- [ ] Gerar pelo worker ("Arquivar no GED") e conferir que o documento nasce `ready` e igual
- [ ] Cabeçalho ISO (`form_controls`) e cor/logo da capa continuam funcionando
- [ ] Conferência visual do PDF com massa sintética (empresa/obra/GES/riscos com e sem medição)

## 16. #47 — Tests

- [ ] Unit do template: ordem das seções, sumário, preposto presente/ausente, NR-09 com/sem medição,
      filtro de agentes, 5W2H conforme Q3, ausência de string fabricada
- [ ] Integração: rota de PDF e `pdf-batch-core`
- [ ] `npm run check` + `npm run build` verdes

## 17. Regressão

- [ ] Inventário de riscos e cobertura do plano (#42) intactos na tela
- [ ] GED: arquivar PGR, histórico de versões (#56) e download
- [ ] Formulário de avaliação segue funcionando no critério qualitativo

## 18. Rebase e PR

- [ ] Rebase em `origin/develop` (`--force-with-lease` no push)
- [ ] Abrir **PR #2** — #47 partes A + B + D; **não** fecha #47
- [ ] Comentar em #47 o que ficou para o Lote 3 (seção NR-17)
- [ ] Sem merge automático — merge é do usuário

## 19. Encerramento do lote

- [ ] `lots/lot-02/REVIEW.md` escrito
- [ ] `lots/lot-02/QA.md` (roteiro + execução) escrito
- [ ] Fichas `tasks/039-*.md` e `tasks/047-*.md` com a tabela de execução preenchida
- [ ] `LOTS.md` / `EXECUTION-PLAN.md` atualizados com o estado real
- [ ] Board: #39 → Done; #47 continua aberta (Lote 3)
