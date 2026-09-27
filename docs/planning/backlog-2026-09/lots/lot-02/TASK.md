# Lote 2 — Task

Checklist vivo do Lote 2 — atualizado conforme cada item é concluído **e** testado. Plano em
[PLAN.md](PLAN.md); decisões em [AUDIT.md](AUDIT.md). Tudo numa única branch
(`feature/lot-02-nr09-pgr-pdf`), uma única PR no fim.

## 0. Decisões (pré-requisito)

- [x] Q1 respondida — dados NR-09 em `risk_assessments` (sem tabela dedicada)
- [x] Q2 respondida — conclusão informada/confirmada pelo profissional, com sugestão na UI
- [x] Q3 respondida — 5W2H **7 de 7** com `action_why`/`action_cost` em `control_measures`
- [x] Respostas registradas no AUDIT e no PLAN

## 1. Preparação

- [x] `git fetch origin --prune` — `origin/develop` em `1d7c42e`, base da branch já atualizada
- [x] Última migration conferida no journal: `0048_form_control_type_status`
- [x] Nenhuma PR aberta no repositório
- [x] Branch única do lote: `feature/lot-02-nr09-pgr-pdf` (renomeada de `docs/lot-02-audit-plan`, preservando `743dfc1`)
- [x] Mover #39 e #47 para _In progress_ no board

## 2. #39 — Schema

- [x] Enum `nr09_conclusion` (`below_limit | above_limit | not_applicable`) em `schema/risks.ts`
- [x] Colunas em `riskAssessments`: `evaluation_method`, `measured_value`, `measured_unit`,
      `tolerance_limit_value`, `nr09_conclusion`
- [x] CHECK: valor medido exige unidade e unidade diferente de `qualitative_na`
- [x] `npm run db:generate` (número só agora) e revisar o SQL gerado
- [x] Conferir que a migration **não** recria policy/GRANT (herdados) e que o journal ficou coerente
- [x] Aplicar em Postgres efêmero e rodar o teste de RLS da tabela

## 3. #39 — Domain

- [x] Campos novos em `riskAssessmentInputSchema` (`domains/pgr/risk-assessment.ts`), todos opcionais
- [x] Regra pura: quantitativo com valor exige unidade; qualitativo não aceita campos quantitativos
- [x] `domains/pgr/nr09.ts`: agentes elegíveis (`physical|chemical|biological`), sugestão de conclusão
      (só quando as unidades batem), rótulos pt-BR de método/conclusão
- [x] Nenhuma regra nova no repositório ou na UI — as três camadas chamam a função pura

## 4. #39 — Repository

- [x] `repositories/risk-assessments.ts`: persistir e devolver os campos novos (create/update/get/list)
- [x] Manter o cálculo de `riskLevel`/`result` intocado
- [x] `getPgrConsolidated`: avaliação vigente passa a trazer método, valor, unidade, LT numérico e
      conclusão

## 5. #39 — Actions/REST

- [x] Server Actions de avaliação carregando os campos (sem ação nova)
- [x] REST `POST/GET /api/v1/risks/{id}/assessments` e `GET/PUT/DELETE /api/v1/risk-assessments/{id}`
- [x] `docs/api/api-design.md` atualizado (campos e regra de validação)
- [x] `docs/api/sst-manager.postman_collection.json` atualizado nas duas pastas

## 6. #39 — UI

- [x] Bloco "Avaliação quantitativa (NR-09)" no `assessment-form.tsx`, visível só no critério
      quantitativo
- [x] Sugestão de conclusão quando houver valor e limite comparáveis, com botão "Usar sugestão"
- [x] Exibir os campos no detalhe do risco e na aba consolidada do PGR
- [x] Estado honesto para risco quantitativo sem medição

## 7. #39 — Tests

- [x] Unit: schema Zod (4 casos de validação), sugestão de conclusão, elegibilidade por agente
- [x] Integração: criar/editar com campos NR-09; CHECK do banco; cross-tenant; `client` → `FORBIDDEN`
- [x] `npm run check` verde
- [x] N/A — branch única do lote; a PR sai no fim, com #39 e #47 juntas

## 8. #47 — Preparação

- [x] N/A — mesma branch do lote; #39 não precisa estar mergeada, só verde
- [x] Gate interno da #39 verde antes de tocar no template

## 9. #47 — View model (consolidado)

- [x] `PgrConsolidated.pgr` ganha empresa completa (CNPJ, nome fantasia, CNAE, atividade, grau de
      risco, endereço) e unidade completa (tipo, contrato, endereço, vigência, preposto, título e
      registro profissional)
- [x] Repositório amplia a query 1 (sem consulta nova; sem N+1)
- [x] Tipos e testes unitários do consolidado atualizados

## 10. #47 — Seção 1 (Identificação)

- [x] `PgrPdfSectionKey` ganha `identification`
- [x] Bloco com Empresa, Unidade/Obra, Responsável técnico (nome, registro, ART) e **Preposto**
      (`manager_name` — `manager_role`)
- [x] Campo vazio → "não informado"
- [x] Sumário reflete a seção

## 11. #47 — Seção 2 (NR-01)

- [x] Inventário passa a imprimir código eSocial, unidade, concentração, LT textual, cobertura do
      plano (#42) e EPIs indicados
- [x] Layout A4 conferido no CSS (cabeçalho de tabela repetido, linha sem quebra); conferência
      visual do PDF fica na seção 15

## 12. #47 — Seção 3 (NR-09)

- [x] Nova seção `nr09` no template, por GES, só com agentes elegíveis
- [x] Colunas: agente, descrição, método, resultado + unidade, LT, conclusão, data
- [x] Risco elegível sem medição → "sem medição"; GES sem risco elegível → linha única explicando
- [x] Nenhum valor herdado do risco nem da avaliação qualitativa

## 13. #47 — Seção 4 (NR-17)

- [ ] BLOCKED — depende da #40. O template **não** ganha seção vazia nem dado de outro módulo.

## 14. #47 — Seção 5 (5W2H)

- [x] Migration `action_why`/`action_cost` em `control_measures` (segunda migration do lote)
- [x] Campos no formulário de medida (criar e editar) + validação + 4 superfícies de API
- [x] Tabela do plano 5W2H completa (O quê, Por quê, Onde, Quando, Quem, Como, Quanto), lida de
      `control_measures`
- [x] Título da seção descreve exatamente o que ela contém
- [x] **Nenhum** dado vindo de `action_plans` / ponte #51

## 15. PDF — verificação dos dois chamadores

- [ ] Gerar pela rota `GET /api/v1/pgr/[id]/pdf` e conferir o arquivo
- [ ] Gerar pelo worker ("Arquivar no GED") e conferir que o documento nasce `ready` e igual
- [ ] Cabeçalho ISO (`form_controls`) e cor/logo da capa continuam funcionando
- [ ] Conferência visual do PDF com massa sintética (empresa/obra/GES/riscos com e sem medição)

## 16. #47 — Tests

- [x] Unit do template: ordem das seções, sumário, preposto presente/ausente, NR-09 com/sem medição,
      filtro de agentes, 5W2H conforme Q3, ausência de string fabricada
- [ ] Integração: rota de PDF e `pdf-batch-core`
- [ ] `npm run check` + `npm run build` verdes

## 17. Regressão

- [ ] Inventário de riscos e cobertura do plano (#42) intactos na tela
- [ ] GED: arquivar PGR, histórico de versões (#56) e download
- [ ] Formulário de avaliação segue funcionando no critério qualitativo

## 18. Walkthrough, review e QA

- [ ] `WALKTHROUGH.md` do lote escrito
- [ ] `REVIEW.md` do lote escrito
- [ ] `QA.md` escrito **antes** da execução e preenchido com o resultado real
- [ ] QA Playwright de #39 (avaliação quantitativa, sugestão, conclusão humana, persistência)
- [ ] QA Playwright do 5W2H (7 campos, persistência, PDF, ausência honesta)
- [ ] PDF real conferido pela rota **e** pelo worker
- [ ] Responsivo 375 / 768 / 1440
- [ ] Massa sintética removida (dados + Storage)

## 19. Rebase final e PR única

- [ ] `git fetch origin --prune && git rebase origin/develop` (conflitos resolvidos semanticamente)
- [ ] Migrations revalidadas após o rebase (journal, snapshots, banco do zero)
- [ ] Repetir testes e fluxos críticos do Playwright depois do rebase
- [ ] Push da branch e **uma única PR** (`Closes #39`; #47 apenas parcialmente endereçada)
- [ ] Board: #39 → In review; #47 continua In progress
- [ ] Sem merge automático — merge é do usuário

## 20. Encerramento do lote

- [ ] Fichas `tasks/039-*.md` e `tasks/047-*.md` com a tabela de execução preenchida
- [ ] `LOTS.md` / `EXECUTION-PLAN.md` atualizados com o estado real
- [ ] #47 permanece aberta com comentário do que falta (NR-17 / #40)
