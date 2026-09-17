# #42 — [PGR] Regras de vinculação do Plano de Ação por nível de risco

https://github.com/Projetos-sst/pgr/issues/42

> **Auditoria específica (2026-09-16, `develop` @ `690ec1b`) — prevalece sobre a classificação
> inicial.** Resultado: deixa de ser quick win (dificuldade 2 → **3**). As decisões de produto foram
> tomadas em 2026-09-16 (seção "Decisões definitivas") e a prontidão passou a **READY COM PREMISSAS**.

## Pedido real da issue

1. Trivial/tolerável → medida já implementada, MANTER.
2. Moderado a intolerável → medida nova, com prazo e responsável obrigatórios.
3. Status da medida: MANTER / INTRODUZIDA / APRIMORADA.
4. Todo risco do inventário, qualquer nível, gera entrada correspondente no plano de ação.

Critérios: trivial/tolerável sugere/força MANTER; moderado+ exige prazo e responsável; todo risco tem
entrada correspondente; integração Postgres quando Action/API mudar; `npm run check`.

## Fluxo real reconstruído

```
risks (GES)                                   schema/risks.ts:105
  └─ risk_assessments (1:N, histórico)        :147  result = snapshot da classificação na avaliação
       classificação = deriveAssessmentResult  domains/pgr/risk-assessment.ts:88-94 (bandas da org)
  └─ control_measures (1 por risco × nível)   :199  UNIQUE(org, risk, control_level)
       status maintain|introduced|improved     :94-98, :211 (migration 0031)
       regra #42 no repositório                repositories/control-measures.ts:92-109
       └─ ponte #51 → action_plans             repositories/control-measure-bridge.ts:52-113
            origin_type = 'control_measure'    (sem FK; action-plan-origin.ts:11)
Consolidado do PGR                            repositories/pgr-consolidated.ts → domains/pgr/pgr-consolidated.ts
PDF "Plano de ação"                           pgr-pdf-template.ts:163-184 (lê control_measures)
Módulo Plano de Ação (Segurança)             actions/safety/action-plans.ts → repositories/action-plans.ts
```

Server Action e REST de medidas chamam o mesmo repositório, então a regra vale nas duas superfícies.

## A. Entidade correta do status

**`control_measures`** — e já está implementado. Evidências:

- Vocabulário da NR-01 1.5.5.2.1: o plano de ação indica as **medidas de prevenção** a serem
  introduzidas, aprimoradas ou mantidas. O status qualifica a medida, não o plano nem o risco.
- A hierarquia de controle (eliminação → EPI) é uma linha por risco × nível; cada nível pode ser mantido
  ou introduzido independentemente.
- `action_plans` é o módulo multiorigem de Segurança (risco, incidente, medida) com ciclo próprio
  `planned|in_progress|completed|cancelled` — outro eixo semântico.

Descartados: `action_plans` (misturaria ciclo de execução com classificação normativa), relação
risco↔plano (não existe tabela e o status é por medida), item de plano (não existe entidade).

**Gap:** o status é gravado e aparece no formulário e na lista de medidas do risco (`MeasureStatusBadge`,
`risks/[id]/control-measures/page.tsx:87`), mas **não no consolidado do PGR**. `ConsolidatedMeasure`
(`domains/pgr/pgr-consolidated.ts:73-87`) não tem `status`; o PDF mostra só a situação derivada
(Sem plano/Planejada/Vencida).

## B. "Todo risco gera entrada no plano"

Hoje nada garante isso. Risco pode ter zero medidas; o PDF lista só medidas `applicable`
(`pgr-pdf-template.ts:166-167`) e imprime "Sem medidas de controle aplicáveis" quando não há nenhuma.

| Opção                                 | Viável sem inventar conteúdo? | Motivo                                                                        |
| ------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| 1. Criar `action_plan` automático     | **Não**                       | `what/why/who/where/how` são NOT NULL (`schema/action-plans.ts:45-50`)        |
| 2. Criar `control_measure` automática | **Não**                       | Exigiria escolher um `control_level` arbitrário (NOT NULL + UNIQUE por nível) |
| 3. Projetar/derivar o risco no plano  | **Sim**                       | Todo risco aparece no plano do PGR com estado derivado; zero migration        |
| 4. Entidade intermediária 1:1         | Sim, mas                      | Duplica `control_measures`, exige sincronização e migration, sem ganho        |
| 5. Reaproveitar estrutura existente   | Sim                           | É a base da opção 3                                                           |

**Recomendação: 3 sobre 5.** O plano de ação **do PGR** passa a listar todo risco do inventário, com
suas medidas (status + 5W2H + situação) ou uma linha de pendência explícita. A cobertura é derivada:

| Cobertura derivada | Condição                                                                                |
| ------------------ | --------------------------------------------------------------------------------------- |
| `not_assessed`     | Risco sem avaliação                                                                     |
| `no_measure`       | Avaliado, sem nenhuma medida                                                            |
| `incomplete`       | Moderado+ com medida aplicável sem responsável ou prazo (possível após reclassificação) |
| `covered`          | Demais casos                                                                            |

**Ambiguidade resolvida (decisão 1):** a issue cita `actions/safety/action-plans.ts`, mas o "plano de ação"
desta issue é o **plano do PGR** feito de `control_measures`.

## C. Classificação (enum real `risk_classification`, `schema/risk-methodology.ts:28-34`)

| Grupo                 | Valores                                  | Constante no código                                          |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| A — trivial/tolerável | `trivial`, `tolerable`                   | complemento de `MODERATE_PLUS_CLASSIFICATIONS`               |
| B — moderado+         | `moderate`, `substantial`, `intolerable` | `MODERATE_PLUS_CLASSIFICATIONS` (`control-measure.ts:64-68`) |

Classificação vigente = `risk_assessments.result` da avaliação mais recente
(`ORDER BY assessed_at DESC, created_at DESC`, `repositories/control-measures.ts:69-81`). As faixas são
configuráveis por organização (`risk_methodology`), mas as 5 classes são fixas.

## D. Prazo e responsável

- `action_responsible` texto livre; `action_deadline` date (`schema/risks.ts:219-220`).
- **Obrigatoriedade:** grupo B **e** `applicable = true` → `ValidationError` 422 no repositório
  (`:96-104`), em create e update. Grupo B com medida não aplicável não exige.
- **Status:** default só quando vazio (`maintain` no grupo A, `introduced` no B). Valor explícito vence
  (teste "status explícito … vence o default"). Ou seja: **sugere, não força**.
- **Onde validar:** repositório está correto — depende da avaliação vigente (outra tabela), que o Zod não
  enxerga. **DB CHECK não é adequado** (dependência entre tabelas; um trigger bloquearia a inserção de uma
  nova avaliação).
- **UI:** `control-measure-form.tsx:207,214` marca O quê/Como obrigatórios quando aplicável, mas **não**
  sinaliza responsável/prazo para risco moderado+ — o usuário só descobre pelo erro do servidor.

## E. Mudança de classificação (não explicitada na issue)

| Transição             | Hoje                                                                                                      | Classificação                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| tolerável → moderado+ | Medidas existentes não são revisadas; podem ficar sem responsável/prazo, e a próxima edição falha com 422 | **Decisão de produto**                                 |
| moderado+ → tolerável | `introduced` permanece; responsável/prazo permanecem                                                      | Inferível: manter (status é escolha humana registrada) |
| Histórico             | Avaliações têm histórico (1:N); medidas não                                                               | Inferível: sem histórico novo nesta issue              |
| Entrada no plano      | Nada muda                                                                                                 | Com a opção 3, a cobertura é recalculada na leitura    |

Recomendação: **nunca mutar status/campos automaticamente**; expor `incomplete` como pendência derivada.

## F. Exclusão

- `DELETE risk` → CASCADE em `risk_assessments` e `control_measures` (FKs `onDelete: cascade`).
- `action_plans` **não** tem FK: planos com origem `risk` ou `control_measure` permanecem, marcados como
  origem removida (`OriginSnapshot.removed`, FR-036), **com o status inalterado** — um plano ativo pode
  continuar "planejado" apontando para um risco que não existe mais.
- `deleteControlMeasure` (`repositories/control-measures.ts:229-239`) **não** chama a ponte, então o plano
  espelhado continua ativo.
- Com a opção 3 não há entrada persistida a apagar. O comportamento dos planos órfãos é dívida
  pré-existente (#51), fora do escopo mínimo.

## G. Duplicidade

- Não há UNIQUE em `action_plans(org_id, origin_type, origin_id)`. A ponte usa `LIMIT 1`
  (`control-measure-bridge.ts:37-50`), e o `POST /action-plans` aceita `origin_type = control_measure`,
  então é possível ter dois planos para a mesma medida.
- Para origem `risk`, 1:N é legítimo (várias ações por risco) — não restringir.
- Com a opção 3, "1 risco → 1 entrada" é garantido por construção (projeção). Endurecimento opcional:
  índice parcial `UNIQUE (org_id, origin_id) WHERE origin_type = 'control_measure'` (migration).

## Achado pré-existente relevante (não criado por esta issue)

A ponte **já grava texto padrão em campos humanos** de `action_plans`:
`who = "Responsável não definido"`, `why = "Medida de controle nível …"`, `where = nome do GES` ou
"Ambiente não informado" (`control-measure-bridge.ts:88-97`). Além disso, uma medida `maintain` aplicável
vira plano `planned`, embora a medida já esteja implementada. Registrar como dívida e decidir antes de
qualquer lote que dependa de `action_plans` (ex.: #47).

## H. Migration

**NÃO** para a arquitetura recomendada. Índice parcial da ponte = migration opcional, em PR separada.

## Arquitetura recomendada

1. Domínio puro `deriveRiskPlanCoverage(risk)` → `not_assessed | no_measure | incomplete | covered`.
2. `ConsolidatedMeasure` ganha `status`; `ConsolidatedRisk` ganha `planCoverage` (sem coluna nova).
3. Aba Inventário do PGR: contador por cobertura + badge por risco + atalho para cadastrar medida.
4. Formulário da medida: sinalizar responsável/prazo obrigatórios quando o risco vigente for moderado+
   (a validação continua no servidor).
5. PDF: **fora desta issue** (decisão 5) — entra no Lote 2 com #47.

## Endpoints/actions afetados

Leitura do consolidado (`getPgrConsolidated` e sua superfície REST/Action) — mudança aditiva no DTO,
documentar em `api-design.md`. Actions/REST de medidas inalteradas.

## UI afetada

`pgr/[id]/_components/pgr-consolidated-tab.tsx`, `pgr-editor-tabs.tsx`,
`risks/[id]/control-measures/_components/control-measure-form.tsx`.

## Testes

- **UNIT:** cobertura para as 4 situações; as 5 classes → grupo A/B; transição tolerável→moderado com
  medida sem responsável → `incomplete`; moderado→tolerável mantém `covered` e o status; default de status
  (existente).
- **INTEGRATION:** consolidado traz `status` e `planCoverage`; nova avaliação que muda a classe altera a
  cobertura **sem mutar** medidas; risco sem medida aparece como `no_measure`; exclusão do risco apaga
  medidas em cascata e o plano espelhado fica com `removed = true` (documenta o comportamento atual).
- **REST/ACTION:** shape do consolidado; 422 do moderado+ sem prazo continua (existente, 9 casos).
- **RLS:** consolidado de outro tenant não retorna riscos (existente em `pgr-consolidated.test.ts`).
- **E2E:** aba Inventário com contador e badge (Playwright 375/768/1440).

## Decisões definitivas (2026-09-16)

Não reabrir.

1. **Qual plano:** "Plano de Ação" = plano do PGR baseado em `control_measures`. **Não** é o módulo
   `action_plans`; nenhum `action_plan` é criado para satisfazer a issue, e a ponte que grava texto padrão
   não é expandida.
2. **Todo risco tem entrada:** garantia **suave e explícita**. Todo risco do inventário aparece na projeção
   do plano com cobertura derivada (não avaliado / sem medida / incompleto / coberto), mesmo sem medida.
   Nada é inventado: sem medida fake, plano fake, prazo, responsável, controle, descrição ou justificativa.
3. **Sem bloqueio:** assinatura/publicação do PGR não são bloqueadas nesta issue. A fatia indica, destaca,
   contabiliza e permite correção. Bloqueio futuro = regra própria.
4. **Reclassificação:** trivial/tolerável → moderado+ não altera medidas; o risco aparece como
   **incompleto** enquanto medidas aplicáveis não tiverem prazo e responsável. Moderado+ → trivial/tolerável
   preserva status, prazo e responsável (registro humano).
5. **PDF:** não muda nesta issue; vai para o Lote 2 junto com #47.
6. **Sem migration.** Se surgir necessidade real, parar só esta issue e documentar.

## Dificuldade

**3/5** — sem migration, mas decisão semântica, 4 camadas (domínio, consolidado, UI, testes) e impacto
indireto no PDF (#47).

## Prontidão

**READY COM PREMISSAS** — decisões tomadas; premissa: vocabulário final da cobertura definido no domínio/UI.

## Cobertura atual

50% — status, regra por nível e testes prontos; cobertura por risco e exposição do status ausentes.

## Lote recomendado

**1B** — terceira do Lote 1 (depois de #56 e #33), na PR única do lote.

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
