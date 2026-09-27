# Lote 2 — Auditoria

**Data:** 26/09/2026 · **Base:** `develop` em `1d7c42e` (Lote 1 mergeado nas PRs #93 e #94; nenhuma
mudança de código depois disso) · **Última migration:** `0048_form_control_type_status` · **PRs
abertas:** nenhuma · **Board:** #39 e #47 seguem em _Backlog_.

Esta auditoria substitui, para #39 e #47, o que a auditoria geral de 16/09 supôs. Quando divergirem,
vale este documento.

**Baseline (antes de qualquer implementação):** `npm run check` **verde** — 0 erros de lint (4
warnings pré-existentes: três `<img>` e um import não usado), typecheck limpo, **1 256 testes
unitários em 138 suítes**. As três suítes que o lote vai mexer (`pgr-pdf-template`, `pgr-consolidated`,
`risk-assessment`) somam **34 testes**, todas verdes.

## Issues

- **#39** — [PGR] Integração com NR-09 (avaliação de agentes físicos/químicos/biológicos). Aberta,
  sem comentários.
- **#47** — [PGR] Montar estrutura completa do PDF do PGR (NR-01/09/17). Aberta, sem comentários.
- **#40** — NR-17 (lida só para medir o bloqueio da seção 4 de #47). Aberta, sem comentários.

## Estado atual — a cadeia real

```
GES → risks → risk_assessments (matriz 5×5, histórico 1:N) → control_measures (1 por nível NR-01)
                      │                                                │
                      │                                                └─(ponte #51)→ action_plans
                      ▼
      getPgrConsolidated (6 queries) → buildPgrHtml → Gotenberg → PDF
                                              ▲
                      dois chamadores: rota síncrona e worker de lote
```

Arquivos de referência: `src/shared/db/schema/risks.ts`, `src/shared/domains/pgr/risk-assessment.ts`,
`src/shared/db/repositories/risk-assessments.ts`, `src/shared/db/repositories/pgr-consolidated.ts`,
`src/shared/domains/pgr/pgr-consolidated.ts`, `src/shared/domains/pgr/pgr-pdf-template.ts`,
`src/shared/server/platform/pgr-pdf-core.ts`, `src/shared/server/platform/pdf-batch-core.ts`,
`src/shared/db/repositories/control-measure-bridge.ts`.

---

# #39 — NR-09

## Requisito

Registrar, ligado a um risco do inventário: **tipo de agente**, **método de avaliação**,
**resultado**, **limite de tolerância** e **conclusão** (NR-09 item 9.4.3), e levar isso ao PGR.

## Estado do código

Nada no repositório menciona NR-09. O que existe é matéria-prima genérica:

- `risks.agent_type` (enum `risk_agent_type`, 7 valores) — o grupo do agente já é obrigatório por
  risco.
- `risks.noxious_agent_code` (eSocial S-2240), `risks.measurement_unit` (enum `measurement_unit`, 10
  valores incluindo `qualitative_na`), `risks.concentration_intensity` (`numeric`, nullable).
- `risk_assessments`: `criterion` (`qualitative|quantitative`), P×S com `risk_level` persistido e
  CHECK de coerência, `uncertainty_degree`, **`tolerance_limit` em TEXTO LIVRE**, `result` — que é a
  **classificação do risco** (trivial…intolerável), não o valor medido — e `assessed_at` (histórico
  1:N).
- Regra existente no domínio do risco: concentração exige unidade quantitativa.
- 4 superfícies de API já prontas para avaliações (Server Actions +
  `POST/GET /api/v1/risks/{id}/assessments` + `GET/PUT/DELETE /api/v1/risk-assessments/{id}`),
  formulário em `risks/[id]/assessments/_components/assessment-form.tsx`, histórico e "avaliação
  vigente" (`getCurrentRiskAssessmentAction`, `DISTINCT ON` no consolidado).
- Laudo/relatório de medição: **já é possível anexar** — `documentRelatedEntityTypeSchema` inclui
  `risk` (`domains/documents/validity.ts`). Nenhum trabalho novo para isso.

## Matriz de dados (#39)

| Campo              | Existe hoje?   | Fonte atual                        | Tipo atual             | Reutilizável?                | Precisa persistir?      | Observação                                                                                             |
| ------------------ | -------------- | ---------------------------------- | ---------------------- | ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `agentType`        | **Sim**        | `risks.agent_type`                 | enum 7 valores         | **Sim, integralmente**       | Não (já persiste)       | Não criar enum novo; NR-09 cobre `physical/chemical/biological` — os demais ficam fora da seção        |
| `evaluationMethod` | Não            | —                                  | —                      | —                            | **Sim**                 | Texto livre com sugestões (NHO-01, NHO-06, NIOSH…); NR-09 não fixa lista fechada — enum seria invenção |
| `result` (medido)  | **Parcial**    | `risks.concentration_intensity`    | `numeric` no **risco** | Não como está                | **Sim**, por avaliação  | Valor no risco não tem data nem método; medição é evento, pertence à avaliação                         |
| `measurementUnit`  | **Sim (enum)** | `risks.measurement_unit`           | enum 10 valores        | **Enum sim**, coluna não     | **Sim**, por avaliação  | Unidade da medição é snapshot histórico, como o `result` da classificação                              |
| `toleranceLimit`   | **Parcial**    | `risk_assessments.tolerance_limit` | **texto**              | Sim, p/ referência normativa | **Sim**, valor numérico | Manter o texto (ex.: "NR-15 Anexo 1") e somar `tolerance_limit_value numeric`                          |
| `conclusion`       | Não            | —                                  | —                      | —                            | **Sim**                 | Ver decisão D3                                                                                         |

## Decisões de #39

- **D1 — Cardinalidade.** Recomendação: **uma avaliação NR-09 por linha de `risk_assessments`**
  (Opção A), não tabela nova. Evidência: a issue diz "avaliação NR-09 vinculada a um risco";
  `risk_assessments` já é o registro de avaliação, já tem histórico por `assessed_at`, já tem
  `criterion = quantitative` esperando conteúdo, já tem noção de vigente consumida pelo consolidado e
  pelo #42. A Opção B (tabela `risk_quantitative_evaluations`) duplicaria histórico, "vigente", 4
  superfícies de API e UI para ganhar só a possibilidade de N medições dentro da mesma avaliação —
  que ninguém pediu. **Decidido (D-Q1): opção A.**
- **D2 — Onde mora.** Colunas novas em `risk_assessments`, preenchidas **apenas** quando
  `criterion = 'quantitative'`; CHECK condicional no banco (valor medido exige unidade). Qualitativo
  continua funcionando exatamente como hoje.
- **D3 — Conclusão.** Recomendação: **informada pelo técnico**, com a UI **sugerindo** o valor quando
  houver valor medido e LT numérico na mesma unidade. O servidor **não** infere sozinho
  `resultado > LT ⇒ não conforme` (fatores de correção, dose, jornada e picos mudam o julgamento).
  Formato: enum curto (`below_limit | above_limit | not_applicable`) + o texto livre já existente para
  a justificativa. **Decidido (D-Q2): informada, com sugestão na UI.**
- **D4 — LT.** Nem todo agente tem limite numérico (biológicos, por exemplo). Fica `tolerance_limit`
  (texto, já existe) **mais** `tolerance_limit_value numeric` opcional. Resolvido tecnicamente, sem
  pergunta.
- **D5 — Laudo.** Reusar anexo de documento ao risco (já suportado). Resolvido, sem pergunta.

## Histórico vs. vigente (#39)

O PGR/PDF mostra hoje **a avaliação vigente** (última por `assessed_at`, desempate por `created_at`),
e é assim que #42 calcula cobertura. A seção NR-09 seguirá a mesma regra: **vigente por risco**, com o
histórico permanecendo acessível na tela de avaliações. Não há requisito de "escolher manualmente"
uma medição para o documento — se aparecer, vira issue própria.

## Migration (#39)

**SIM** — necessária. Estrutura pretendida (conceitual; sem número reservado e sem SQL gerado):

- `risk_assessments`: `evaluation_method text`, `measured_value numeric`,
  `measured_unit measurement_unit` (enum existente), `tolerance_limit_value numeric`,
  `nr09_conclusion` (enum novo `nr09_conclusion`) — todas nullable.
- CHECK: valor medido exige unidade; unidade medida diferente de `qualitative_na` quando há valor.
- Sem FK/índice novos (a tabela já indexa `org_id` e `risk_id`); RLS/GRANT/trigger de `updated_at`
  **herdados** da tabela — a migration não recria política, mas o teste de RLS tem de continuar verde.
- Enum novo entra com `CREATE TYPE`; ampliar depois exige `ALTER TYPE … ADD VALUE` fora de transação.

## UI (#39)

Ponto único: **formulário de avaliação do risco** (`/risks/{id}/assessments/new` e `/edit`), num bloco
"Avaliação quantitativa (NR-09)" que aparece quando `criterion = quantitative`. É o fluxo onde o
técnico já informa critério, P×S e LT — não se cria tela nova e o dado tem dono e manutenção.
Exibição: aba consolidada do PGR e PDF (seção 3, entregue por #47). Caminho completo: formulário →
`createRiskAssessmentAction` / `PUT /api/v1/risk-assessments/{id}` → `repositories/risk-assessments.ts`
→ `risk_assessments` → `getPgrConsolidated` → `buildPgrHtml`.

## Permissões / tenant (#39)

Sem novidade: `officeAction`/`restHandler` + `requireOfficeStaff()`, `withOrg` e a policy de
`risk_assessments` já cobrem. Testes obrigatórios: cross-tenant (avaliação de outro escritório →
`NOT_FOUND`/`FK_NOT_FOUND`), papel `client` → `FORBIDDEN`, RLS das colunas novas.

## Riscos (#39)

1. Conflito conceitual entre `risks.concentration_intensity` (valor no risco) e o valor medido na
   avaliação. **Mitigação:** a seção NR-09 lê **da avaliação**; o campo do risco continua como
   "concentração de referência" e o PLAN registra a fonte única.
2. `result` já significa classificação — nomear o valor medido de `measured_value` evita a colisão.
3. `ALTER TYPE` de enum fora de transação, se um dia precisar ampliar a conclusão.

---

# #47 — PDF do PGR

## Pipeline real

`getPgrConsolidated(orgId, pgrId)` (6 queries em lote, sem N+1) → `buildPgrHtml(data, options)`
(HTML+CSS A4 puro) → `htmlToPdf` (Gotenberg) → resposta binária. **Dois chamadores**:
`pgr-pdf-core.generatePgrPdf` (rota `GET /api/v1/pgr/[id]/pdf`, aceita `?color=`) e
`pdf-batch-core.processPdfBatchJob` (worker, grava no GED). Ordem atual do HTML: capa → cabeçalho ISO
opcional (`form_controls`) → sumário → por GES: inventário, plano, hierarquia.
`PgrPdfSectionKey = "risks" | "actionPlan" | "controlHierarchy"`.

## Matriz das 5 seções

| Ordem | Seção            | Existe hoje?   | Fonte dos dados                                                                               | Completa? | Dependência         | Gap                                                                                                               |
| ----- | ---------------- | -------------- | --------------------------------------------------------------------------------------------- | --------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1     | Identificação    | Parcial (capa) | `companies.razao_social`/`website`, `work_units.name`, `pgr.responsible`/`registration*`, ART | Não       | —                   | Falta **preposto** (`work_units.manager_name`/`manager_role`), CNPJ, endereços, e seção própria em vez de só capa |
| 2     | Inventário NR-01 | Sim            | consolidado (riscos + avaliação vigente + medidas + EPIs + cobertura #42)                     | Quase     | —                   | Não imprime LT, concentração, unidade, código eSocial, EPIs nem a cobertura do plano — **tudo já no consolidado** |
| 3     | NR-09            | **Não**        | —                                                                                             | Não       | **#39**             | Seção inteira                                                                                                     |
| 4     | NR-17            | **Não**        | —                                                                                             | Não       | **#40** (não feita) | Seção inteira — **fora do Lote 2**                                                                                |
| 5     | Plano 5W2H       | Parcial        | `control_measures` via consolidado                                                            | Não       | #42 (feito) + Q3    | Imprime O quê/Como/Responsável/Prazo/Situação; faltam **Por quê**, **Onde** e **Quanto**                          |

## Seção 1 — Identificação (fontes reais)

- **Empresa:** `companies` tem `razao_social`, `nome_fantasia`, `cnpj`, `cnae`, `main_activity`,
  `risk_grade`, endereço completo, `logo_path`, `website`. O consolidado hoje lê **só** razão social e
  site — ampliar a query (sem migration).
- **Unidade/obra:** `work_units` tem `name`, `type`, `contract_number`, `description`, datas de
  vigência, endereço, `manager_name`, `manager_role`, `professional_title`,
  `professional_registration`. O consolidado lê **só** `name`.
- **Responsável técnico:** fonte real é `pgr.responsible` + `pgr.registration_type` /
  `registration_number` (o formulário do PGR pede "Nome completo do responsável" e o tipo de registro
  CRM/CREA/MTE), mais o documento de ART anexado
  (`related_entity_type = responsible_technician`). **Não** usar o usuário logado.
- **Preposto:** `work_units.manager_name` + `manager_role`. **Validado semanticamente**: o formulário
  de unidade rotula exatamente "Gestor/Preposto" e "Cargo do gestor/preposto"
  (`work-units/_components/work-unit-form.tsx`). É o campo que o produto já chama de preposto — não
  precisa de campo novo. Quando vazio: estado honesto ("não informado"), nunca substituto.

## Seção 2 — Inventário NR-01

O consolidado já entrega, por risco: agente, descrição, perigo, fontes, propagação, tempo de
exposição, lesões possíveis, código eSocial, unidade, concentração, avaliação vigente detalhada,
medidas com status e estado, EPIs indicados e `planCoverage` (#42). O PDF imprime 5 colunas. É a seção
mais barata do lote: ampliar o template, **zero** mudança de dados.

## Seção 3 — NR-09

Consome o modelo de #39. Regras: agrupar por GES (como o resto do PDF); imprimir agente, método,
resultado + unidade, LT (numérico e/ou normativo) e conclusão da **avaliação vigente**; risco sem
avaliação quantitativa entra como "sem medição" — **nunca** herdar valor do risco nem repetir a
avaliação qualitativa como se fosse medição; risco cujo agente não é físico/químico/biológico fica
fora da tabela (e o PDF diz quantos ficaram de fora, em vez de fingir que não existem).

## Seção 4 — NR-17

**BLOQUEADA por #40**, que não tem nenhuma linha de código (o módulo `psychosocial` é outro assunto:
campanhas e questionários, não AET). O que #47 precisa de #40, como contrato de dados: por risco (ou
por GES), avaliação ergonômica vigente com postura, movimentos, carga física, carga mental,
organização do trabalho e ambiente físico, mais data e responsável — e, se houver instrumento
psicossocial, o resultado agregado. Enquanto #40 não existir, o template **não** ganha a seção (uma
seção vazia num documento entregue ao cliente é pior do que nenhuma).

## Seção 5 — Plano de ação 5W2H

| Elemento 5W2H     | Campo real existente                              | Entidade           | Completo?     | Observação                                                       |
| ----------------- | ------------------------------------------------- | ------------------ | ------------- | ---------------------------------------------------------------- |
| What (o quê)      | `action_what`                                     | `control_measures` | **Sim**       | Obrigatório quando a medida é aplicável                          |
| Why (por quê)     | — (`justification` é "por que **não** se aplica") | `control_measures` | **Não**       | `action_plans.why` existe, mas a ponte preenche com texto gerado |
| Where (onde)      | `ges.name` (derivável)                            | `ges` via `risks`  | **Derivável** | Dado real do cadastro, desde que rotulado como GES/unidade       |
| When (quando)     | `action_deadline`                                 | `control_measures` | **Sim**       | —                                                                |
| Who (quem)        | `action_responsible`                              | `control_measures` | **Sim**       | Vazio é vazio; #42 já exige em risco moderado+                   |
| How (como)        | `action_how`                                      | `control_measures` | **Sim**       | —                                                                |
| How much (quanto) | —                                                 | —                  | **Não**       | Só `action_plans.how_much`, que a ponte deixa `null`             |

Ou seja: com `control_measures` + derivação de "onde", o PDF entrega **5 dos 7** elementos com dado
real. Faltam **Por quê** e **Quanto**.

## Ponte #51 (`control-measure-bridge.ts`)

- **Gatilho:** dentro da transação de `createControlMeasure` / `updateControlMeasure`.
- **Comportamento:** medida não aplicável → cancela o plano ativo; medida aplicável sem
  `action_what`/`action_how` → não cria nada; plano já concluído/cancelado não é reaberto.
- **Campos copiados (reais):** `what` ← `action_what`, `how` ← `action_how`,
  `when` ← `action_deadline`.
- **Campos fabricados:** `who` ← `action_responsible` **ou `"Responsável não definido"`**;
  `why` ← `justification` **ou `"Medida de controle nível <N>"`**; `where` ← nome do GES **ou
  `"Ambiente não informado"`**. `how_much`, `priority` e `type` ficam nulos.
- **Motivo histórico:** `action_plans.why/who/where` são `NOT NULL`; a ponte precisa preencher algo.
- **Consumidores:** módulo `/action-plans` e quem mais lê `action_plans`. O PDF **não** lê
  `action_plans` hoje.
- **Se deixar de ser usada:** o módulo de Plano de Ação perde as linhas espelhadas das medidas; nada
  no PDF muda.
- **Impacto no #47:** decisivo. Ler o 5W2H de `action_plans` é o caminho aparentemente pronto e é
  justamente o que a **regra absoluta** proíbe: três dos sete campos seriam texto gerado pelo sistema
  apresentado como informação do usuário, num documento legal.
- **Recomendação:** **MANTER TEMPORARIAMENTE** (não mexer neste lote; o módulo depende dela) e abrir
  issue própria para trocar os literais por vazio, tornando `why`/`who`/`where` nuláveis em
  `action_plans`. O PDF do #47 **não** a consome.

## Divisão de #47

| Parte | Conteúdo                                                    | Situação                                                                       |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **A** | Seção 1 (identificação com preposto) + Seção 2 (inventário) | **READY AGORA**                                                                |
| **B** | Seção 3 (NR-09)                                             | **READY APÓS #39** — mesmo lote                                                |
| **C** | Seção 4 (NR-17)                                             | **BLOCKED por #40** — Lote 3                                                   |
| **D** | Seção 5 (5W2H)                                              | **NEEDS PRODUCT DECISION** (Q3): 5/7 com dado real agora, ou 7/7 com migration |

## Migration (#47)

**NÃO.** Tudo que as partes A, B e D precisam já está persistido — exceto se a resposta de **Q3** for
"7 de 7", que adiciona `action_why` e `action_cost` a `control_measures` (migration pequena, sem RLS
nova).

## Testes (#47)

`domains/pgr/__tests__/pgr-pdf-template.test.ts` (10 casos hoje) precisa cobrir a nova ordem das
seções e os estados honestos; `__tests__/integration/reports/pgr-pdf-route.test.ts` e
`server/platform/__tests__/pdf-batch-core.test.ts` garantem que **os dois chamadores** continuam
gerando. O PDF do worker e o da rota têm de sair equivalentes — só cor e logo mudam.

## Riscos (#47)

1. O PDF é entregável ao cliente: qualquer regressão aparece direto no produto final.
2. Dois chamadores — mudar o template sem olhar o worker quebra o arquivamento no GED.
3. Cabeçalho ISO (`form_controls`) e sumário precisam acompanhar as seções novas.
4. Estado honesto: "sem medição" não pode parecer "conforme".

---

# Dependências

```
#39 (migration + dado NR-09) ──► #47 Parte B (seção 3)
#42 (feito, Lote 1) ──────────► #47 Parte D (plano, lido de control_measures)
#40 (não iniciada) ───────────► #47 Parte C (seção 4) → Lote 3
```

Arquivos disputados: `pgr-consolidated.ts` (domínio + repositório) e `pgr-pdf-template.ts` — tocados
por #39 (leitura) e #47 (impressão). Por isso o lote roda **em série**, numa branch por issue.

# Decisões tomadas (27/09/2026)

As três perguntas desta auditoria foram respondidas pelo usuário antes da implementação. Não são mais
questões em aberto.

## D-Q1 — modelo da avaliação NR-09 → **colunas em `risk_assessments`**

Nada de tabela dedicada. Motivos aceitos: a tabela já representa uma avaliação do risco, já tem
histórico por data, já é consumida pelo consolidado e pelas regras da #42, já tem
`criterion = 'quantitative'`, e a issue não pede várias medições dentro da mesma avaliação — tabela
separada duplicaria conceito, API, UI e vigência.

## D-Q2 — conclusão NR-09 → **informada/confirmada pelo profissional**

O sistema pode **sugerir** comparando valor medido e limite quando isso for tecnicamente possível, mas
a sugestão é auxílio: não é autoridade técnica, não substitui a conclusão humana, não sobrescreve uma
conclusão já escolhida e não é recalculada silenciosamente pelo backend. Persiste-se o que o usuário
confirmou.

## D-Q3 — plano do PGR → **5W2H completo, 7 de 7, a partir de `control_measures`**

`action_plans` não é fonte. Os dois elementos que faltavam (**Why** e **How much**) passam a ser dados
reais da própria medida, com colunas novas; sem backfill fictício e sem obrigatoriedade retroativa.
"Where" continua derivado do GES/contexto real do risco e, onde não houver contexto suficiente, o
documento mostra ausência honesta em vez de texto inventado.

# Classificação final

| Issue   | Dificuldade | Prontidão                                                               | Migration                                      | Risco                                               | Cobertura hoje |
| ------- | ----------- | ----------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- | -------------- |
| **#39** | **3/5**     | **READY** (Q1 e Q2 decididas em 27/09)                                  | **SIM** (colunas + enum em `risk_assessments`) | Médio                                               | ~25%           |
| **#47** | **3/5**     | **A, B e D READY** (B depois de #39; D com 7/7) · **C BLOCKED por #40** | **NÃO** (ou pequena, se Q3 = 7/7)              | Médio-alto (entregável ao cliente, dois chamadores) | ~50%           |

# Recomendação

Rodar o Lote 2 **em série, duas PRs**: primeiro #39 (dado), depois #47 partes A + B + D (documento),
deixando #47 aberta até a seção NR-17 do Lote 3. A ponte #51 fica intocada e fora do PDF.
