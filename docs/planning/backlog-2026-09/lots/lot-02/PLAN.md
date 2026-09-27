# Lote 2 — Plan

**Issues:** #39 (NR-09) e #47 (PDF do PGR, partes A, B e D) · **Base:** `develop` em `1d7c42e`
(última migration `0048`) · **Fonte:** [AUDIT.md](AUDIT.md).

> **Decisões fechadas em 27/09/2026** (D-Q1, D-Q2, D-Q3 no [AUDIT](AUDIT.md)): dados NR-09 em
> `risk_assessments`; conclusão informada pelo profissional, com sugestão na UI; plano do PGR com
> 5W2H **completo (7 de 7)** a partir de `control_measures`. O único bloqueio remanescente é a seção
> NR-17, que depende da #40.

## Objetivo

Levar ao PGR o dado de avaliação quantitativa exigido pela NR-09 e transformar o PDF, hoje uma capa
mais três blocos por GES, num documento com seções nomeadas e ordenadas: identificação, inventário
NR-01, NR-09 e plano de ação — com dado real, sem preencher lacuna com texto inventado.

## Escopo

1. **#39** — registrar avaliação NR-09 (método, valor medido, unidade, limite de tolerância numérico
   e conclusão) na avaliação de risco, com validação, API, formulário e testes.
2. **#47 parte A** — seção 1 (identificação: empresa, unidade/obra, responsável técnico, preposto) e
   seção 2 (inventário NR-01 completo, aproveitando o que o consolidado já carrega).
3. **#47 parte B** — seção 3 (NR-09), consumindo #39.
4. **#47 parte D** — seção 5 (plano de ação 5W2H), na forma que a resposta de Q3 definir.

## Fora de escopo

- **#40 / seção 4 (NR-17)** e o fechamento de #47 — Lote 3. #47 **permanece aberta** ao fim deste
  lote.
- Alterar a ponte #51 ou o módulo `/action-plans` (ver "Ponte #51").
- Tela nova de NR-09 fora do formulário de avaliação; relatório separado de medições.
- Anexo de laudo (já funciona: documento vinculado ao risco).
- Assinatura, revisões, cabeçalho ISO — intocados.

## Decisões herdadas (não reabrir)

- **Plano do PGR = `control_measures`** (Lote 1 / #42). `action_plans` é módulo genérico, não fonte
  do PGR.
- **Cobertura do plano é derivada na leitura** (`deriveRiskPlanCoverage`), nunca persistida, e
  reclassificar risco não reescreve dado humano.
- **Estado honesto**: campo sem dado aparece como vazio/"não informado"; nada de texto de
  preenchimento.
- **Dois chamadores do PDF** (rota síncrona e worker) — qualquer mudança de template vale para os
  dois.

## Arquitetura #39

Decidido (D-Q1): colunas em `risk_assessments`.

Camadas, na ordem do fluxo:

1. `schema/risks.ts` — colunas novas em `riskAssessments` + enum `nr09_conclusion`.
2. `domains/pgr/risk-assessment.ts` — campos no `riskAssessmentInputSchema` e regra de coerência
   (função pura, testável).
3. `domains/pgr/nr09.ts` (novo) — regras puras da NR-09: quais agentes entram, sugestão de conclusão
   a partir de valor × LT, rótulos.
4. `repositories/risk-assessments.ts` — persistir/ler os campos novos; nada de regra.
5. Server Actions + REST já existentes — só passam a carregar os campos novos (sem rota nova).
6. `assessment-form.tsx` — bloco condicional.
7. `pgr-consolidated.ts` (domínio + repositório) — expor a avaliação quantitativa vigente.

## Modelo de dados #39

Decidido (D-Q1 e D-Q2):

| Coluna                  | Tipo                          | Nulo | Regra                                                           |
| ----------------------- | ----------------------------- | ---- | --------------------------------------------------------------- |
| `evaluation_method`     | `text`                        | sim  | Livre, com sugestões na UI (NHO-01, NHO-06, NIOSH, dosimetria…) |
| `measured_value`        | `numeric`                     | sim  | Valor medido; só faz sentido com `criterion = quantitative`     |
| `measured_unit`         | enum `measurement_unit`       | sim  | Reusa o enum existente; obrigatório quando há `measured_value`  |
| `tolerance_limit_value` | `numeric`                     | sim  | Complementa o `tolerance_limit` textual já existente            |
| `nr09_conclusion`       | enum `nr09_conclusion` (novo) | sim  | `below_limit \| above_limit \| not_applicable`                  |

Regras (na aplicação **e** com CHECK no banco onde couber):

- `measured_value` exige `measured_unit`, e a unidade não pode ser `qualitative_na`.
- Campos quantitativos só são aceitos quando `criterion = 'quantitative'`; no qualitativo, o servidor
  ignora/zera em vez de gravar lixo.
- `tolerance_limit_value` e `measured_value` comparáveis só quando a unidade é a mesma — a
  comparação é **sugestão de UI**, não verdade persistida.
- A conclusão é **informada pelo profissional** (D-Q2). O servidor não a deriva nem a sobrescreve; a
  sugestão vive no domínio puro e é oferecida pela UI.
- **Fonte única:** o valor que a NR-09 exibe é o da avaliação. `risks.concentration_intensity`
  permanece como "concentração de referência" do risco e **não** alimenta a seção 3.

## UI #39

- `risks/[id]/assessments/new` e `/[assessmentId]/edit`: bloco **"Avaliação quantitativa (NR-09)"**,
  visível quando `criterion = quantitative`, com método (texto + sugestões), valor medido, unidade
  (select do enum, pré-selecionada com a unidade do risco), LT numérico, LT normativo (campo de texto
  que já existe) e conclusão (select) com sugestão automática quando houver os dois números.
- Nenhuma tela nova. Detalhe do risco e aba consolidada do PGR passam a exibir os campos.
- Empty state: risco quantitativo sem medição aparece como "sem medição", nunca como conforme.

## API/Actions #39

Sem rota nova: os campos entram no corpo já existente.

| Superfície        | Endpoint/ação                                                             | Mudança                              |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| Server Action     | `createRiskAssessmentAction` / `updateRiskAssessmentAction`               | Campos novos no input validado       |
| REST (lista/cria) | `GET/POST /api/v1/risks/{id}/assessments`                                 | Campos novos no corpo e na resposta  |
| REST (item)       | `GET/PUT/DELETE /api/v1/risk-assessments/{id}`                            | idem                                 |
| Docs + Postman    | `docs/api/api-design.md` + `docs/api/sst-manager.postman_collection.json` | Campos documentados nos dois lugares |

Erros reusados: `VALIDATION` (422) para as regras novas; `NOT_FOUND`/`FK_NOT_FOUND`/`FORBIDDEN` como
hoje. Nenhum código de erro novo.

## Arquitetura #47

Template ganha seções nomeadas; a ordem do documento passa a ser:

```
capa → cabeçalho ISO (opcional) → sumário →
  1. Identificação
  2. Inventário de riscos (NR-01), por GES
  3. Avaliação quantitativa (NR-09), por GES
  [4. Ergonomia (NR-17) — Lote 3]
  5. Plano de ação (5W2H), por GES
```

`PgrPdfSectionKey` passa a incluir `identification | risks | nr09 | actionPlan | controlHierarchy`
(hierarquia de controles continua, como apêndice do inventário). O default segue "todas ligadas", e o
sumário lista exatamente as seções ligadas. Alimentação: **só** ampliar `getPgrConsolidated` — nenhuma
consulta nova no template, nenhuma chamada de rede a mais.

## Seção 1 — Identificação

- Consolidado passa a carregar: empresa (razão social, nome fantasia, CNPJ, CNAE, atividade
  principal, grau de risco, endereço) e unidade (nome, tipo, nº do contrato, endereço, vigência,
  `manager_name`, `manager_role`, título e registro profissional).
- Template imprime blocos "Empresa", "Unidade/Obra", "Responsável técnico" (nome + tipo/nº de
  registro + ART anexada quando existir) e "Preposto" (`manager_name` — `manager_role`).
- Campo vazio → "não informado". Nada de placeholder inventado.

## Seção 2 — NR-01

Tabela do inventário ganha as colunas que já existem no consolidado e hoje não são impressas: código
do agente (eSocial), unidade, concentração de referência, limite de tolerância textual, cobertura do
plano (#42) e EPIs indicados. Sem mudança de dados.

## Seção 3 — NR-09

Uma tabela por GES, só com riscos de agente `physical | chemical | biological`: agente, descrição,
método, resultado + unidade, LT (numérico e/ou normativo), conclusão e data da avaliação. Risco
elegível sem medição aparece como "sem medição"; se nenhum risco do GES for elegível, o bloco diz
isso em uma linha.

## Seção 4 — NR-17

`BLOCKED UNTIL #40`. Não entra no template neste lote. O contrato de dados esperado está no AUDIT.

## Seção 5 — 5W2H

Decidido (D-Q3): **7 de 7**. `control_measures` ganha `action_why` (motivo real da medida) e
`action_cost` (custo estimado, `numeric` como os demais valores de domínio do projeto); os dois campos
entram no formulário de medida, na validação, nas 4 superfícies de API e no consolidado. Sem backfill
e sem obrigatoriedade retroativa: medida antiga sem motivo/custo aparece como ausência honesta.

Mapa final da seção: **What** `action_what` · **Why** `action_why` · **Where** GES do risco (derivado
do cadastro; sem contexto → ausência honesta) · **When** `action_deadline` · **Who**
`action_responsible` · **How** `action_how` · **How much** `action_cost`.

O PDF lê `control_measures` pelo consolidado e **não** toca em `action_plans`.

## Ponte #51

Intocada neste lote. Fica registrada a recomendação do AUDIT: **manter temporariamente** e tratar os
literais fabricados (`Responsável não definido`, `Medida de controle nível …`, `Ambiente não
informado`) em issue própria, tornando `why`/`who`/`where` nuláveis em `action_plans`. Nenhum desses
campos entra no PDF.

## Migrations previstas

| Migration               | Issue   | Conteúdo                                                          | Condição         |
| ----------------------- | ------- | ----------------------------------------------------------------- | ---------------- |
| `00NN_nr09_evaluation`  | #39     | Enum `nr09_conclusion` + 5 colunas em `risk_assessments` + CHECKs | Depende de Q1    |
| `00NN_measure_why_cost` | #47 (D) | `action_why`, `action_cost` em `control_measures`                 | Só se **Q3 = B** |

Número **não** reservado: gerar com `npm run db:generate` só depois de sincronizar `develop`, na hora
de implementar. RLS/GRANT/trigger são herdados das tabelas existentes — nenhuma policy nova.

## RLS

Nenhuma policy nova. `risk_assessments` e `control_measures` já têm isolamento por
`org_id = current_setting('app.current_org', true)`; todo acesso continua por `withOrg`. Os testes de
integração precisam provar que as colunas novas obedecem ao mesmo isolamento (leitura cross-tenant
não retorna a medição).

## Testes

**#39**

- Unit: schema Zod (valor exige unidade; unidade não pode ser `qualitative_na`; quantitativo vs.
  qualitativo), sugestão de conclusão (abaixo/acima/empate/unidades diferentes → sem sugestão),
  rótulos.
- Integração (Postgres efêmero): criar/editar avaliação com campos NR-09; CHECK do banco recusando
  valor sem unidade; cross-tenant; `client` → `FORBIDDEN`; RLS das colunas novas.

**#47**

- Unit do template: ordem das 5 seções (com a 4 ausente), sumário coerente, preposto impresso e
  ausente, NR-09 com e sem medição, filtro de agentes não elegíveis, 5W2H conforme Q3, nenhuma string
  fabricada no HTML.
- Integração: rota `GET /api/v1/pgr/[id]/pdf` (200 + `application/pdf`) e `pdf-batch-core` (worker)
  — os **dois** chamadores.
- Regressão: `npm run check` + build; suíte `pgr-consolidated`.

## Estratégia de branches

**Uma só:** `feature/lot-02-nr09-pgr-pdf` (renomeada de `docs/lot-02-audit-plan`, preservando o commit
da auditoria). Tudo — decisões, #39, #47, walkthrough, review, QA — vive nela. Rebase em
`origin/develop` antes da PR; `--force-with-lease`, nunca `--force`. Merge é do usuário.

## Estratégia de PRs

**Recomendada — Estratégia B (duas PRs em série):**

| PR    | Conteúdo                                               | Fecha                           |
| ----- | ------------------------------------------------------ | ------------------------------- |
| PR #1 | #39 completa (migration, 4 superfícies, UI, testes)    | Fecha **#39**                   |
| PR #2 | #47 partes A + B + D (template + consolidado + testes) | **Não** fecha #47 — falta NR-17 |

Por quê: a migration fica isolada numa PR pequena e reversível; a mudança do template — que é o
entregável visível ao cliente e tem dois chamadores — é revisada sozinha. Uma PR única misturaria
migration com contrato visual e dificultaria rollback. Uma PR por seção do PDF geraria três rebases
no mesmo arquivo sem ganho de revisão.

## Dependências

- **Entrada:** decisões D-Q1, D-Q2 e D-Q3 — fechadas.
- **Interna:** #47 parte B depende de #39 mergeada.
- **Saída:** Lote 3 (#40 + fechamento de #47) começa com a seção 4 e o critério de aceite completo da
  #47.

## Riscos

| Risco                                                    | Mitigação                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| PDF é entregue ao cliente — regressão aparece no produto | Testes dos dois chamadores + conferência manual do PDF antes da PR         |
| Dois chamadores do template                              | Item explícito no TASK: gerar pela rota **e** pelo worker                  |
| Colisão conceitual medição × `concentration_intensity`   | Fonte única registrada no PLAN e comentada no código                       |
| Enum novo difícil de ampliar                             | Três valores cobrem a NR-09; ampliação futura via `ALTER TYPE` documentada |
| Seção sem dado parecendo conformidade                    | Estado honesto testado no unit do template                                 |
| Migration concorrente na `develop`                       | Gerar a migration só na hora, após `git pull --ff-only`                    |

## Definition of Done

- Decisões D-Q1, D-Q2 e D-Q3 registradas (feito em 27/09).
- #39: migration aplicada em Postgres efêmero com RLS verde; 4 superfícies de API (Action, REST,
  `api-design.md`, Postman); formulário funcionando; unit + integração novos.
- #47: PDF com as seções 1, 2, 3 e 5 na ordem, gerado **pela rota e pelo worker**, conferido
  manualmente; template com testes de ordem e de estado honesto; nenhuma string fabricada.
- `npm run check`, integração e `npm run build` verdes; QA de regressão do PDF/GED registrado.
- #39 fechada; #47 **aberta**, com comentário do que faltou (NR-17) e link para o Lote 3.
- `REVIEW.md` e `QA.md` do Lote 2 escritos; fichas 039/047 atualizadas.

## Itens bloqueados

| Item                                | Bloqueio                     |
| ----------------------------------- | ---------------------------- |
| Seção 4 (NR-17) e fechamento de #47 | `BLOCKED UNTIL #40` (Lote 3) |

Q1, Q2 e Q3 foram respondidas em 27/09 — ver "Decisões tomadas" no [AUDIT](AUDIT.md).
