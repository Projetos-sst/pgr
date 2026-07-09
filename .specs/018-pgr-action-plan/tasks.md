---
description: "Task list — Medidas de controle e plano de ação do risco (5W2H)"
---

# Tasks: Medidas de controle e plano de ação do risco (5W2H)

**Input**: Design documents from `.specs/018-pgr-action-plan/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Feature**: 018 · `feature/pgr-action-plan` · tabela real **`control_measures`** (migration `0012`)
· **ZERO MIGRATION**.

## Convenções

- Formato: `- [ ] [TaskID] [P?] [Story?] descrição — arquivo`. `[P]` = paralelizável (arquivos
  distintos, sem dependência pendente).
- Histórias: **US1** registrar 5W2H (P1) · **US2** consultar + contexto + estado derivado (P2) ·
  **US3** editar (P3) · **US4** excluir (P3).
- **Guardrails absolutos** (valem para toda task): NÃO migration; NÃO tocar
  `src/shared/db/schema/**` nem `migrations/**`; NÃO coluna/enum de status; NÃO FK de responsável;
  NÃO snapshot de avaliação; NÃO alterar `risk_methodology`; NÃO alterar CRUD de `risks` (exceto
  botão); NÃO IA/recomendação/geração automática dos 4 níveis; NÃO aceitar
  `orgId`/`organizationId`/`organization_id` do client; NÃO PATCH parcial.

---

## Fase 1 — Setup / higiene

- [ ] T001 Confirmar branch `feature/pgr-action-plan` e `.specify/feature.json` →
  `.specs/018-pgr-action-plan` (`git branch --show-current`; `cat .specify/feature.json`). Critério:
  ambos batem.
- [ ] T002 Confirmar zero schema/migration antes de começar
  (`git diff -- src/shared/db/schema src/shared/db/migrations` vazio; `.env` não aparece). Critério:
  diff vazio; nenhum secret impresso.
- [ ] T003 Registrar no `tasks.md` a dívida conhecida: `CLAUDE.md` falha `format:check` e será
  corrigido **só na Fase 11** (gates finais). Critério: nota presente; `CLAUDE.md` intocado agora.
- [ ] T004 Revisar contratos aprovados antes de codar
  (`.specs/018-pgr-action-plan/contracts/*.md` + `data-model.md`). Critério: nomes reais de colunas
  `control_measures` e enum `control_level` conferidos contra `src/shared/db/schema/risks.ts`.

---

## Fase 2 — Domain (`src/shared/domains/pgr/control-measure.ts`) — Foundational

Bloqueia repository/actions/REST/UI/testes. Arquivo único → tasks sequenciais.

- [ ] T005 Criar `src/shared/domains/pgr/control-measure.ts` reusando `controlLevelSchema`,
  `controlLevelLabel` e `type ControlLevel` de `./risks`; reexportar
  `type ControlMeasure from "@/shared/db/schema/risks"`. Critério: import resolve; sem redefinir o
  enum.
- [ ] T006 Definir `applicableField` (preprocess robusto: boolean|`"true"`/`"on"`/`"1"`→true;
  `"false"`/`""`/`"0"`/undefined→false; default false) — **não** usar `z.coerce.boolean`. Critério:
  `"false"` → `false` em teste manual de tipo.
- [ ] T007 Definir `controlMeasureInputSchema` (`z.object`): `controlLevel` (enum obrigatório),
  `applicable`, `justification`/`monitoring`/`actionWhat`/`actionHow`/`actionTracking`/
  `actionMeasurement`/`actionResponsible` = `optionalString`, `actionDeadline` = `optionalIsoDate`;
  `.superRefine`: se `applicable===true` exigir `actionWhat` e `actionHow` (issue por path, pt-BR).
  Exportar `ControlMeasureInput` (z.input) e `ControlMeasureValues`/`ControlMeasureWriteValues`
  (z.output; sem tipo duplicado desnecessário — P2 naming). Critério: schema compila.
- [ ] T008 [P] Adicionar projeção `ControlMeasureListItem` (`actionDeadline: string | null`,
  `createdAt: Date`, sem estado) + labels dos estados derivados (`without_plan`→"Sem plano",
  `planned`→"Planejada", `overdue`→"Vencida"). Critério: tipos exportados.
- [ ] T009 [P] Implementar funções puras `isOverdue(applicable, actionDeadline, today)` e
  `deriveMeasureState(measure, today): "without_plan"|"planned"|"overdue"` — `today` **parâmetro**
  `AAAA-MM-DD`; comparação lexicográfica de string date; sem ler relógio. Critério: funções puras
  exportadas, determinísticas.

---

## Fase 3 — Repository (`src/shared/db/repositories/control-measures.ts`) — Foundational

Depende de T005–T009. Arquivo único → sequencial. Espelha `repositories/risk-assessments.ts`.

- [ ] T010 Criar o arquivo com `"server-only"`; imports (`withOrg`, `controlMeasures`, `risks`,
  `type ControlMeasure` de `../schema/risks`; `auditedTenantWrite`; `ReferenceNotFoundError`;
  paginação). Critério: compila.
- [ ] T011 Implementar `assertRiskInTenant(tx, orgId, riskId)` (SELECT `risks` por `org_id`+`id`;
  senão `throw new ReferenceNotFoundError("risk")`) + `toWriteColumns` (todos os `action_*` +
  `justification`/`monitoring` com `?? null`; **sem** `control_level`/`risk_id`). Critério: helpers
  prontos.
- [ ] T012 Implementar `listControlMeasures(orgId, riskId, params?)`: `withOrg` +
  `assertRiskInTenant` + filtro `controlMeasures.orgId`+`riskId` + ordenação **NR-01**
  (`array_position`) + projeção `ControlMeasureListItem` + total. Critério: retorna
  `Paginated<ControlMeasureListItem>`.
- [ ] T013 Implementar `getControlMeasureById(orgId, id)` (por `(org_id,id)`, sem join; `null` se
  ausente) e `createControlMeasure(orgId, riskId, values)` (`auditedTenantWrite` +
  `assertRiskInTenant` + INSERT com `controlLevel`; **sem** catch de 23505 — sobe para DUPLICATE).
  Critério: create retorna a linha; duplicidade lança 23505.
- [ ] T014 Implementar `updateControlMeasure(orgId, id, values)` (UPDATE por `(org,id)` com
  `toWriteColumns` + `updatedAt`; **não** toca `control_level`/`risk_id`; `null` se ausente) e
  `deleteControlMeasure(orgId, id)` (DELETE físico RETURNING → boolean). Critério: update ignora
  nível; delete retorna boolean.

---

## Fase 4 — Server Actions (`src/shared/server/actions/pgr/control-measures.ts`) — Foundational

Depende de T005–T014. Espelha `actions/pgr/risk-assessments.ts`.

- [ ] T015 Criar o arquivo com `"use server"`; `officeAction`; `ActionResult`; imports do domínio e
  do repo; helper `revalidateMeasure(riskId, measureId?)` revalidando `/risks/[id]`,
  `.../control-measures`, `.../new`, `.../[measureId]/edit`. Critério: compila; sem import de
  Drizzle.
- [ ] T016 [US2] Implementar `listControlMeasuresAction(riskId, params?)` e
  `getControlMeasureAction(id)` (`null`→`NotFoundError`) — **sem** audit. Critério: retornam
  `ActionResult`.
- [ ] T017 [US1] [US3] Implementar `createControlMeasureAction(riskId, input)` e
  `updateControlMeasureAction(riskId, id, input)`: `controlMeasureInputSchema.parse` antes do repo;
  `{ audit: true }`; update `null`→`NotFoundError`; `revalidateMeasure`. Critério: create 201-ready;
  update valida corpo completo.
- [ ] T018 [US4] Implementar `deleteControlMeasureAction(riskId, id)` (`{ audit: true }`;
  `false`→`NotFoundError`; `revalidateMeasure`). **Opcional** `getControlMeasureContextAction(riskId)`
  agregando `{ risk, currentAssessment }` **apenas** se reduzir round-trips — sem audit, sem
  persistência. Critério: delete retorna `{ id }`.

---

## Fase 5 — REST (`restHandler`) — Foundational

Depende de T010–T014 (reusa repo/schema). Arquivos distintos → T019/T020 podem ser [P].

- [ ] T019 [P] Criar `src/app/api/v1/risks/[id]/control-measures/route.ts`: `runtime="nodejs"`,
  `dynamic="force-dynamic"`; `GET` (list via `pageParamsFrom`) + `POST`
  (`controlMeasureInputSchema.parse(await req.json())` + `createControlMeasure`, `status: 201`).
  Critério: list 200, create 201, duplicate 409, FK 422.
- [ ] T020 [P] Criar `src/app/api/v1/control-measures/[id]/route.ts`: `GET`/`PUT` (recompõe corpo
  completo)/`DELETE` (`status: 204`); `null`→`NotFoundError`. Critério: get/put 200, delete 204,
  cross-tenant 404.
- [ ] T021 Conferir mapeamento de erro herdado (`toActionError`/`HTTP_BY_CODE`): 23505→DUPLICATE/409,
  ReferenceNotFoundError→FK_NOT_FOUND/422, NotFoundError→NOT_FOUND/404, ZodError→VALIDATION/422,
  client→FORBIDDEN/403. Critério: nenhum handler reimplementa regra; tenant nunca do body/query.

---

## Fase 6 — UI (`src/app/(protected)/risks/[id]/control-measures/`)

Depende das Actions (Fase 4). Componentes em arquivos distintos → vários [P].

- [ ] T022 [P] `_components/control-measure-state.tsx` (ou util de apresentação): recebe medida +
  `today` (SP), usa `deriveMeasureState`, renderiza badge `Sem plano`/`Planejada`/`Vencida` com
  **destaque de vencida**. Critério: os 3 estados renderizam; vencida destacada.
- [ ] T023 [P] `_components/risk-context.tsx`: exibe contexto read-only do risco (agente/perigo/
  descrição/fontes/possíveis lesões/código nocivo/tempo exposição) + avaliação vigente
  (`riskLevel`/`result`) ou **"Sem avaliação vigente"**. Critério: contexto e fallback exibidos.
- [ ] T024 [P] `_components/responsible-field.tsx`: combobox/autocomplete alimentado por
  `listEmployeesAction` que grava `fullName` como texto; permite texto livre. Critério: seleção
  grava nome; digitação livre funciona; sem FK.
- [ ] T025 `_components/control-measure-form.tsx`: form create/edit — `select` de nível NR-01
  (desabilitado/oculto no edit, nível imutável), `applicable`, campos 5W2H + `justification`/
  `monitoring`, `actionDeadline`, responsável (T024); validação condicional (erros `actionWhat`/
  `actionHow` quando `applicable`); mensagens de erro do `ActionResult`. Critério: cria/edita;
  bloqueia campos mínimos.
- [ ] T026 [P] [US4] `_components/delete-control-measure.tsx`: confirmar-e-remover chamando
  `deleteControlMeasureAction(riskId, id)`. Critério: exclui após confirmação.
- [ ] T027 [US2] `page.tsx` (`/risks/[id]/control-measures`): carrega `getRiskAction` +
  `getCurrentRiskAssessmentAction` + `listControlMeasuresAction`; calcula `today` (America/
  Sao_Paulo, `AAAA-MM-DD`); lista por nível NR-01 com estado derivado + contexto; link "Nova
  medida". Critério: lista + contexto + vencida visíveis.
- [ ] T028 [US1] `new/page.tsx`: usa `requireOfficeStaffPage()`; renderiza contexto + form
  (T025) para create. Critério: cria medida; duplicidade de nível → erro 409/DUPLICATE tratado na
  UI.
- [ ] T029 [US3] `[measureId]/edit/page.tsx`: `getControlMeasureAction` + contexto; form (T025) em
  modo edição (nível read-only). Critério: edita corpo completo.
- [ ] T030 [US2] Tratar erro `DUPLICATE` no fluxo de create da UI (mensagem "Este nível já possui
  medida para o risco"). Critério: 409 vira mensagem amigável, não crash.
- [ ] T031 [US2] EDIT mínimo em `src/app/(protected)/risks/[id]/page.tsx`: adicionar botão/atalho
  "Medidas de controle" → `/risks/${risk.id}/control-measures` (única alteração permitida em
  `risks`). Critério: botão presente; nada mais alterado.

---

## Fase 7 — Docs / Postman

Arquivos distintos → [P] entre si.

- [ ] T032 [P] Atualizar `docs/api/api-design.md`: registrar recurso **Control Measures** (rotas
  nested + flat), verbos, filtros e o código **409 (DUPLICATE)** nas tabelas "Recursos"/"Sumário".
  Critério: recurso documentado com 201/204/409/422/404/403.
- [ ] T033 [P] Atualizar `docs/api/sst-manager.postman_collection.json`: pasta "Medidas de
  Controle" (list by risk, create, get, update, delete) + variável **`controlMeasureId`**; reusar
  `baseUrl`/`devTenant`/`devRole`/`riskId`. Critério: pasta e variável presentes.
- [ ] T034 [P] Adicionar no Postman os exemplos de erro: **403** (client), **404** (cross-tenant),
  **409** (nível duplicado), **422** (validation e FK). Critério: `python -m json.tool`/parser valida
  o JSON da coleção.

---

## Fase 8 — Unit tests (`src/__tests__/unit/domains/pgr/control-measure.test.ts`)

Depende do domínio (Fase 2). Arquivo único.

- [ ] T035 [P] Criar o teste unitário cobrindo o schema: `controlLevel` válido/inválido;
  `applicable` válido (incl. `"false"`→false); `actionWhat`/`actionHow` **obrigatórios** quando
  `applicable=true`; **opcionais** quando `applicable=false`; `actionResponsible` texto livre;
  `actionDeadline` opcional. Critério: casos passam.
- [ ] T036 [P] Testar estados derivados: `deriveMeasureState` → `without_plan`/`planned`/`overdue`;
  `isOverdue` com prazo passado (vencido), prazo futuro (não vencido) e sem prazo (nunca vencido);
  garantir **ausência de status persistido** (nada de coluna status no input/projeção). Critério:
  matriz de estados coberta com `today` fixo.

---

## Fase 9 — Integration tests (`src/__tests__/integration/control-measures/`)

Contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite. Suites em arquivos distintos → [P].

- [ ] T037 [P] `control-measures.test.ts` (Server Actions): list por risk, get, create (persiste
  colunas), update corpo completo, delete; **duplicate por `control_level` → `DUPLICATE`**;
  `riskId` inválido/cross-tenant → `FK_NOT_FOUND`; medida inexistente/cross-tenant → `NOT_FOUND`;
  role `client` → `FORBIDDEN`. Critério: suíte verde no efêmero.
- [ ] T038 [P] `control-measures-isolation.test.ts` (RLS/cross-tenant): reusar `runIsolationSuite`
  (`table: "control_measures"`) — lista não vaza outro tenant; RLS backstop; insert cross-tenant
  bloqueado. Critério: isolamento provado.
- [ ] T039 [P] `rest-control-measures.test.ts` (REST): GET list, POST create (201), GET by id, PUT
  (200), DELETE (204), 403, 404, **409 duplicate**, 422 validation, 422 FK. Critério: status
  corretos **ou** falha 500 documentada (T040).
- [ ] T040 Se `rest-control-measures.test.ts` falhar com 500 por limitação pré-existente do harness
  REST-via-Jest (provada em 014/016), **documentar** no PR/tasks e provar por comparação (rodar um
  `rest-*` já mergeado no mesmo efêmero). Critério: causa registrada; validação real fica no cURL
  (T041).

---

## Fase 10 — Validação manual (quickstart)

- [ ] T041 cURL REST real contra dev server + Postgres efêmero (headers dev-bypass
  `x-dev-tenant`/`x-dev-role`/`x-dev-user`): list 200, create 201, **duplicate 409**, validação 422,
  FK 422, get/put 200, delete 204, client 403, cross-tenant 404. Critério: 100% dos status
  corretos; registrar o **tenant usado** (`org_a`).
- [ ] T042 Criar e **apagar** uma medida de teste via cURL; validar `409` ao repetir o nível.
  Critério: medida de teste removida ao final; sem secrets impressos; nunca Supabase compartilhado.
- [ ] T043 Playwright MCP (se houver credencial Clerk): fluxo criar/editar/excluir + **vencida
  visualmente destacada** + "Sem avaliação vigente" + 409 duplicate na UI. Critério: fluxo validado
  **ou** marcado **bloqueado** (sem credencial) — não falha.
- [ ] T044 Remover o container efêmero ao final (`docker rm -f ...`). Critério: ambiente limpo; nada
  tocado em Supabase.

---

## Fase 11 — Quality gates finais (antes de commit/push/PR)

- [ ] T045 Prettier **dirigido** nos arquivos tocados pela feature (código + artefatos
  `.specs/018-pgr-action-plan/**/*.md`) → todos clean. Critério: `prettier --check` verde nos
  arquivos da feature.
- [ ] T046 Corrigir a **dívida `CLAUDE.md`** neste gate (root-cause: remover a duplicata
  `**Conclusão da Fase 02 /` antes do `prettier`, senão o markdown ao redor é mutilado). Critério:
  `prettier --check CLAUDE.md` verde.
- [ ] T047 `npm run lint` + `npm run typecheck` verdes. Critério: 0 erros.
- [ ] T048 `npm run test` (unit) + `npm run test:integration` (efêmero) verdes; anexar resultado do
  REST (verde ou 500-harness documentado + cURL). Critério: unit/integração ok.
- [ ] T049 `npm run build` verde. Critério: build ok.
- [ ] T050 `npm run format:check` final; ao falhar, **separar** (a) falhas reais da feature
  (corrigir), (b) `CLAUDE.md` (já resolvido em T046), (c) **ruído CRLF pré-existente** (ignorar —
  CI-LF não acusa). Rodar `git status --short`, `git diff --name-status`,
  `git diff -- src/shared/db/schema src/shared/db/migrations` (**vazio**). Critério: só arquivos da
  feature (+ `CLAUDE.md`) mudaram; zero schema/migration; `.env` ausente.

---

## Dependências

- **Fase 1** → tudo.
- **Fase 2 (domínio)** → Fases 3,4,5,6,8.
- **Fase 3 (repo)** → Fases 4,5,9.
- **Fase 4 (actions)** → Fase 6, parte da 9.
- **Fase 5 (REST)** → Fase 9 (rest) + 10 (cURL).
- **Fases 7/8/9** independem entre si (arquivos distintos) após suas deps de camada.
- **Fase 11** por último (gates).

## Grafo de entrega (MVP incremental)

1. **US1 (P1)** = Fase 2 → 3 → 4 (create) → 5 (POST) → 6 (new + form) → 8/9 (create/duplicate). MVP.
2. **US2 (P2)** = list + contexto + estado derivado (T012, T016, T022–T023, T027).
3. **US3 (P3)** = update (T014, T017, T029).
4. **US4 (P3)** = delete (T014, T018, T026).

## Paralelização (exemplos)

- Após T009: T019 ‖ T020 (REST, arquivos distintos).
- Após T015: T022 ‖ T023 ‖ T024 ‖ T026 (componentes distintos).
- Fase 7: T032 ‖ T033 ‖ T034. Fase 8: T035 ‖ T036. Fase 9: T037 ‖ T038 ‖ T039.

## Confirmações de escopo (materializadas nas tasks)

zero migration (T002/T050) · sem schema · tabela real `control_measures` · sem status persistido
(T009/T036) · estados derivados · responsável texto (T024) · avaliação vigente derivada (T023/T027)
· sem snapshot · **duplicate/409 real** (T013/T037/T041) · REST/docs/Postman (Fases 5/7) · Postman
`controlMeasureId` (T033) · testes (Fases 8/9) · cURL (T041/T042) · Playwright previsto (T043) ·
`CLAUDE.md` só no gate final (T046).
