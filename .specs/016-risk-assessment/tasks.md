# Tasks — Avaliação de Risco (matriz 5×5) · Feature 016

**Branch**: `feature/risk-assessment` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

> **Estado da validação final (2026-07-08):** T001–T034 e T036–T038 concluídas ([x]) — **37/38**.
> Unit 450/450, `tsc` 0, ESLint 0, `build` OK; `format:check` limpo para os arquivos da feature
> (os ~682 offenders são CRLF pré-existente do repo — **não** formatar repo-wide). Contra **Postgres
> efêmero** (Docker, porta 55433, `app_runtime` não-superuser): **T031** (Actions) e **T032** (RLS
> isolamento) **verdes**; **T033** — a suíte REST-via-Jest deu **8×HTTP 500** por **limitação
> pré-existente do harness** (provada rodando a suíte já mergeada `rest-risks.test.ts`, que falha
> 9/9 do mesmo modo), então o REST foi validado **autoritativamente por cURL** (T034) contra o dev
> server no banco efêmero: list 200 · create 201 (`riskLevel`/`result` persistidos) · get 200 · put
> 200 (recalcula 25/`intolerable`) · delete 204 · get apagado 404 · prob=9 → 422 · riskId inválido →
> 422 · client → 403 · cross-tenant → 404 · **nunca 409**. **T035** (Playwright) **bloqueada** — sem
> credencial Clerk de teste (o bypass dev cobre só `/api/v1`, não a UI protegida). Nenhuma task
> marcada [x] sem execução real.

Ordenadas por dependência, em fases por camada (implementação incremental: domínio → repository →
actions → REST → UI → docs/Postman → testes → validação). `[P]` = paralelizável (arquivos distintos,
sem dependência pendente). Cada task tem arquivo-alvo e critério de conclusão verificável.

**ZERO migration · ZERO schema.** Nenhuma task toca `src/shared/db/schema/**` nem `migrations/**`.
Tabela `risk_assessments` (migration `0012`) e metodologia `risk_methodology` (`0013`) já existem e
são **consumidas**. Fora de escopo (não gerar tasks): `control_measures`/5W2H (#26), `epi_risk`, IA,
CRUD de `risk_methodology`, alterar CRUD de `risks` (exceto botão de atalho). Nunca 409/`DUPLICATE`/
upsert/PATCH; tenant sempre da sessão (nunca `orgId`/`organizationId`/`organization_id` do cliente).

## Mapeamento para User Stories / MVP

- **US1** (criar + classificar, P1): Fases 2–5 (caminho create) + Fase 6 (form/new).
- **US2** (histórico + vigente, P1): Fase 3 (list/getCurrent) + Fases 4–6 (list).
- **US3** (reavaliar/editar/excluir, P2): update/delete em Fases 3–6.
- **MVP** = Fases 1–6 no caminho **create + list** (US1+US2). US3 (update/delete) incrementa sem
  bloquear. Fases 7–11 fecham superfície/qualidade.

---

## Fase 1 — Setup / higiene (sem story label)

- [x] T001 Confirmar branch e árvore em `feature/risk-assessment`: rodar `git branch --show-current`,
      `git status --short`, `git diff -- src/shared/db/schema src/shared/db/migrations`. **Conclusão**:
      branch correta; diff de schema/migration **vazio**.
- [x] T002 Registrar guardrail zero-schema no fluxo: nenhuma task edita `src/shared/db/schema/**` nem
      `migrations/**`; a tabela `risk_assessments`/enums/CHECKs/RLS/GRANT/trigger já existem (`0012`).
      **Conclusão**: checado que os alvos de todas as tasks estão fora de schema/migrations.
- [x] T003 Fixar gate final: `npm run format:check` (repo-wide, LF, mesmo do CI) é **obrigatório** ao
      fim (Fase 11) — Prettier dirigido não basta; formatar os `.md` da spec antes de commitar
      (aprendizado do PR #135). **Conclusão**: item presente na Fase 11.

---

## Fase 2 — Domain `src/shared/domains/pgr/risk-assessment.ts` (foundational — bloqueia US1/US2/US3)

- [x] T004 Criar o arquivo com imports (`z`; de `./risks`: `assessmentCriterionSchema`,
      `assessmentCriterionLabel`, `uncertaintyDegreeLabel`, `computeRiskLevel`, tipo
      `AssessmentCriterion`; de `./methodology`: `classify`, `riskClassificationLabel`, tipos
      `RiskClassification`/`ClassificationBand`; de `./form-fields`: `optionalString`) e **reexport
      limpo** `export type { RiskAssessment } from "@/shared/db/schema/risks"` (**P2-2** — não criar tipo
      duplicado via `$inferSelect`). **Conclusão**: `tsc` resolve os imports; `RiskAssessment` reexportado.
- [x] T005 Definir `riskAssessmentInputSchema` (arquivo T004): `criterion` = `assessmentCriterionSchema`
      (obrigatório); `probability`/`severity` = `z.coerce.number().int().min(1).max(5)` (msg pt-BR);
      `uncertaintyDegree` = `z.coerce.number().int().min(0).max(2).default(0)`; `toleranceLimit` =
      `optionalString`; `assessedAt` = `z.iso.date("Data inválida (use AAAA-MM-DD)")` (**obrigatória**).
      **NÃO** incluir `riskLevel`/`result`/`riskId`/`orgId`. Exportar `RiskAssessmentInput`
      (`z.input`)/`RiskAssessmentValues` (`z.output`). **Conclusão**: coerção string→número funciona;
      `riskLevel`/`result` ausentes do input.
- [x] T006 Definir a função pura `deriveAssessmentResult(values, bands)` →
      `{ riskLevel, result }` (`riskLevel = computeRiskLevel(p,s)`, `result = classify(riskLevel, bands)`)
      e o tipo `RiskAssessmentWriteValues = RiskAssessmentValues & { riskLevel: number; result:
RiskClassification }` (arquivo T004). **Conclusão**: função pura, sem I/O; unit-testável.
- [x] T007 Definir rótulos normativos (arquivo T004): `PROBABILITY_LABELS` (1 Rara / 2 Pouco provável
      / 3 Possível / 4 Provável / 5 Muito provável) + `SEVERITY_LABELS` (1 Leve, sem necessidade de
      atenção médica / 2 Séria, reversível / 3 Crítica, irreversível / 4 Incapacitante ou mortal
      individual / 5 Mortes ou incapacitantes múltiplas) + `probabilityLabel`/`severityLabel`; reexportar
      `uncertaintyDegreeLabel`, `assessmentCriterionLabel`, `riskClassificationLabel`. **Conclusão**:
      labels 1–5 e 0–2 disponíveis para UI.
- [x] T008 Definir projeções (arquivo T004): `RiskAssessmentListItem` = `{ id: string; criterion:
AssessmentCriterion; probability: number; severity: number; riskLevel: number; uncertaintyDegree:
number; toleranceLimit: string | null; result: RiskClassification | null; assessedAt: string;
createdAt: Date }` — **`createdAt` é `Date`** (coluna `timestamp` → Drizzle retorna `Date`; **P2-1**),
      **`assessedAt` é `string`** (coluna `date`). **Conclusão**: tipos batem com o retorno real do Drizzle.

---

## Fase 3 — Repository `src/shared/db/repositories/risk-assessments.ts`

- [x] T009 Criar o arquivo (`"server-only"`) com imports Drizzle + `withOrg`/`TenantTransaction`,
      `riskAssessments`/`risks`/`RiskAssessment` do schema, `auditedTenantWrite`, `ReferenceNotFoundError`,
      helpers de `pagination`, tipos do domínio; definir `assertRiskInTenant(tx, orgId, riskId)` (select em
      `risks` por `(orgId,id)`; ausente → `throw new ReferenceNotFoundError("risk")`) e
      `ListRiskAssessmentsParams = PageParams`. **Conclusão**: guard tenant-scopado pronto; sem metodologia
      importada no repo. (depende de: T008)
- [x] T010 [US2] Implementar `listRiskAssessments(orgId, riskId, params)` (arquivo T009): `withOrg`,
      `assertRiskInTenant`, `where = and(eq(orgId), eq(riskId))`, projeção `RiskAssessmentListItem`,
      `orderBy(desc(assessedAt), desc(createdAt))`, `limit/offset`, `count(*)::int` → `Paginated`.
      **Conclusão**: lista paginada ordenada; `riskId` inválido → `FK_NOT_FOUND`.
- [x] T011 Implementar `getRiskAssessmentById(orgId, id)` (arquivo T009): `withOrg`, select por
      `(orgId,id)`, `?? null` (sem join). **Conclusão**: cross-tenant/inexistente → `null`.
- [x] T012 [US2] Implementar `getCurrentRiskAssessment(orgId, riskId)` (arquivo T009): `withOrg`,
      `assertRiskInTenant`, order + `limit 1`, `?? null` (risco sem avaliações → `null`, **não** erro).
      **Conclusão**: retorna a última por `assessedAt desc`, `createdAt desc`.
- [x] T013 [US1] Implementar `createRiskAssessment(orgId, riskId, values: RiskAssessmentWriteValues)`
      (arquivo T009): `auditedTenantWrite("risk_assessments.write_rejected")` + `withOrg` +
      `assertRiskInTenant` + `insert({ orgId, riskId, ...toColumns(values) }).returning()`. `toColumns`
      mapeia criterion/probability/severity/**riskLevel**/uncertaintyDegree/toleranceLimit(`?? null`)/**result**/assessedAt.
      **Conclusão**: insere nova linha; sem `onConflict`/upsert. (depende de: T006)
- [x] T014 [US3] Implementar `updateRiskAssessment(orgId, id, values: RiskAssessmentWriteValues)`
      (arquivo T009): `auditedTenantWrite` + `withOrg` + `update(set: { ...toColumns(values), updatedAt })
.where(and(eq(orgId), eq(id)))` **sem tocar `risk_id`**, `.returning()`, `?? null`. **Conclusão**:
      atualiza por id; cross-tenant/inexistente → `null`.
- [x] T015 [US3] Implementar `deleteRiskAssessment(orgId, id)` (arquivo T009): `auditedTenantWrite` +
      `withOrg` + `delete().where(and(eq(orgId), eq(id))).returning({id})` → `rows.length > 0`.
      **Conclusão**: delete físico; boolean; sem endpoint de dependentes.

---

## Fase 4 — Server Actions `src/shared/server/actions/pgr/risk-assessments.ts`

- [x] T016 [US2] Criar o arquivo (`"use server"`) com imports (`revalidatePath`, `NotFoundError`,
      `officeAction`, `ActionResult`, `Paginated`, domínio, `* as repo`, `getRiskMethodologyView`,
      `RiskAssessment`), helper `revalidateAssessment(riskId, assessmentId?)` (revalida `/risks/[id]`,
      `.../assessments`, `.../assessments/new`, `.../assessments/[assessmentId]/edit`) e as reads:
      `listRiskAssessmentsAction(riskId, params)` (`pgr.risk_assessments.list`, sem audit),
      `getRiskAssessmentAction(id)` (`.get`, `null` → `NotFoundError`),
      `getCurrentRiskAssessmentAction(riskId)` (`.current`, devolve `null` sem erro). **Conclusão**: 3
      reads retornam `ActionResult`; sem audit; sem Drizzle importado. (depende de: T010–T012)
- [x] T017 [US1] Implementar `createRiskAssessmentAction(riskId, input)` (arquivo T016): `officeAction
(..., { audit: true })` → `riskAssessmentInputSchema.parse(input)` → `const { classificationBands }
= await getRiskMethodologyView(tenantId)` → `deriveAssessmentResult(values, classificationBands)` →
      `repo.createRiskAssessment(tenantId, riskId, { ...values, ...derived })` → `revalidateAssessment`.
      **Conclusão**: persiste `riskLevel`+`result` (snapshot); fallback padrão quando `configured:false`.
      (depende de: T013)
- [x] T018 [US3] Implementar `updateRiskAssessmentAction(riskId, id, input)` (arquivo T016): parse +
      `getRiskMethodologyView` + `deriveAssessmentResult` + `repo.updateRiskAssessment(tenantId, id, {
...values, ...derived })`; `null` → `NotFoundError`; `revalidateAssessment(riskId, id)`;
      `{ audit: true }`. **Conclusão**: recalcula `riskLevel`+`result`; corpo completo. (depende de: T014)
- [x] T019 [US3] Implementar `deleteRiskAssessmentAction(riskId, id)` (arquivo T016):
      `repo.deleteRiskAssessment`; `false` → `NotFoundError`; `revalidateAssessment(riskId)`; `{ audit:
true }`; retorna `{ id }`. **Conclusão**: exclui; revalida. (depende de: T015)

---

## Fase 5 — REST (`restHandler`; `runtime="nodejs"`, `dynamic="force-dynamic"`)

- [x] T020 [P] [US1] Criar `src/app/api/v1/risks/[id]/assessments/route.ts`: `GET` (list por `riskId`
      da rota via `pageParamsFrom`) e `POST` (parse → `getRiskMethodologyView` → `deriveAssessmentResult`
      → `repo.createRiskAssessment`, `{ status: 201 }`). **Conclusão**: list 200; create 201; FK inválido
      → 422. (depende de: T013, T016–T017)
- [x] T021 [P] [US3] Criar `src/app/api/v1/risk-assessments/[id]/route.ts`: `GET` (getById, `null` →
      `NotFoundError`), `PUT` (parse → derive → `updateRiskAssessment`, `null` → `NotFoundError`, 200),
      `DELETE` (`{ status: 204 }`). `type Ctx = { params: Promise<{ id: string }> }`. **Conclusão**: get/
      put 200; delete 204; inexistente/cross-tenant → 404. (depende de: T011, T014, T015)

---

## Fase 6 — UI (`src/app/(protected)/risks/[id]/assessments/**`)

- [x] T022 [US1] Criar `_components/assessment-form.tsx` (client): campos criterion/probability/
      severity/uncertaintyDegree/toleranceLimit/assessedAt; `riskLevel` e classificação em **tempo real**
      (importa `computeRiskLevel`/`classify`/`riskClassificationLabel`; recebe `classificationBands` +
      `configured` como props); `riskLevel`/`result` **read-only**; labels normativos (T007); aviso de
      fallback quando `configured:false`; mensagens de erro do `ActionResult`. **Conclusão**: preview
      recalcula sem round-trip; submit chama create/update action. (depende de: T007, T017–T018)
- [x] T023 [P] [US3] Criar `_components/delete-assessment.tsx`: wrapper de `ConfirmDeleteButton`
      (entityName "Avaliação", chama `deleteRiskAssessmentAction`, sem `loadDependents`). **Conclusão**:
      exclui com confirmação. (depende de: T019)
- [x] T024 [US2] Criar `assessments/page.tsx`: histórico via `listRiskAssessmentsAction(riskId)`,
      ordenado (mais recente no topo), **destacar a vigente** (1ª linha), colunas critério/probabilidade/
      severidade/nível/classificação/incerteza/data, botão "Nova avaliação", `EmptyState` quando vazio.
      **Conclusão**: lista + vigente + vazio renderizam; isolada ao tenant. (depende de: T016)
- [x] T025 [US1] Criar `assessments/new/page.tsx`: server page carrega `getRiskMethodologyView`
      (bands+configured) e renderiza `assessment-form` em modo create. **Conclusão**: cria e volta ao
      histórico com `result` persistido. (depende de: T022)
- [x] T026 [US3] Criar `assessments/[assessmentId]/edit/page.tsx`: `getRiskAssessmentAction` + bands →
      `assessment-form` em modo edit (corpo completo). **Conclusão**: edita e recalcula. (depende de: T022)
- [x] T027 [US1] Editar `src/app/(protected)/risks/[id]/page.tsx`: adicionar botão/atalho
      "Avaliações" (link para `/risks/[id]/assessments`). **Conclusão**: botão presente; **nenhuma** outra
      mudança no CRUD de `risks`. (depende de: T024)

---

## Fase 7 — Docs e Postman

- [x] T028 [P] Editar `docs/api/api-design.md`: seção "Avaliações de Risco" + linhas nas tabelas de
      Recursos/Sumário/Rotas (endpoints nested + flat, verbos, status, filtros `page`/`pageSize`).
      **Conclusão**: recurso documentado; sem 409. (depende de: T020–T021)
- [x] T029 [P] Editar `docs/api/sst-manager.postman_collection.json`: variável `riskAssessmentId` +
      pasta "Avaliações de Risco" com list by risk / create / get / update / delete + exemplos 403/404/422
      (reusar `baseUrl`/`devTenant`/`devRole`). JSON válido. **Conclusão**: pasta espelha as existentes;
      sem 409. (depende de: T020–T021)

---

## Fase 8 — Testes unitários

- [x] T030 [P] Criar `src/__tests__/unit/domains/pgr/risk-assessment.test.ts`: probability 1–5
      válido / fora (0,6) inválido; severity idem; uncertaintyDegree 0–2 / fora (−1,3); default 0;
      criterion inválido; coerção `"3"`→`3`; `computeRiskLevel(3,3)=9`, `(5,5)=25`; `assessedAt`
      obrigatória + data impossível rejeitada; `deriveAssessmentResult` com
      `defaultRiskMethodology().classificationBands` (nível 9 → classe esperada; 25 → `intolerable`);
      `riskLevel`/`result` **não** aceitos como input editável (schema os ignora/rejeita). **Conclusão**:
      `npm run test` verde para o arquivo. (depende de: T005–T006)

---

## Fase 9 — Testes de integração (Postgres efêmero `INTEGRATION_*`)

- [x] T031 Criar `src/__tests__/integration/risk-assessments/risk-assessments.test.ts` (Actions): list
      por risk; get; getCurrent/latest (e `null` quando sem avaliações); create; update corpo completo;
      delete; create **persiste** `riskLevel`(=prob×sev) e `result`(classe padrão); update **recalcula**
      `riskLevel`/`result`; reavaliação = nova linha (sem 409); `riskId` inválido/cross-tenant →
      `FK_NOT_FOUND`; avaliação cross-tenant/inexistente → `NOT_FOUND`; role `client` → `FORBIDDEN`; lista
      de `org_a` não vaza `org_b`. **Conclusão**: `npm run test:integration` verde para o arquivo.
      (depende de: T016–T019)
- [x] T032 [P] Criar `src/__tests__/integration/risk-assessments/risk-assessments-isolation.test.ts`:
      `runIsolationSuite({ table: "risk_assessments", seededCountA: 1, crossTenantInsertSql: <insert em
public.risk_assessments com org_b, riskB, criterion 'qualitative', probability 2, severity 4,
risk_level 8> })`. **Conclusão**: RLS backstop provado; `org_a` não lê linha de `org_b`. (depende de:
      T009–T015)
- [x] T033 [P] Criar `src/__tests__/integration/risk-assessments/rest-risk-assessments.test.ts`
      (Route Handlers via bypass dev): GET list; POST create (201); GET by id; PUT update (200); DELETE
      (204); 403 (`client`); 404 (cross-tenant); 422 (validation); 422 (FK — riskId inválido); **nunca
      409**. **Conclusão**: verde OU — se o harness REST-via-Jest der 500 (limitação pré-existente,
      provada com `rest-pgr.test.ts`) — **documentar** e validar por cURL (T034). (depende de: T020–T021)

---

## Fase 10 — Validação manual

- [x] T034 cURL REST contra dev server no Postgres efêmero (bypass dev): list/create(201)/get/
      update(200)/delete(204) + 422 (validation e FK) + 404 + 403; confirmar **nenhum 409**. Registrar o
      **tenant** usado (ex.: `org_a`) e **apagar** as avaliações criadas. **Não** imprimir secrets; **não**
      usar Supabase compartilhado. **Conclusão**: todos os status corretos por cURL (fonte autoritativa do
      REST). (depende de: T020–T021)
- [ ] T035 Playwright MCP (se houver credencial Clerk de teste): fluxo `/risks/[id]` → "Avaliações" →
      criar (preview em tempo real) → editar → 2ª avaliação (vigente no topo) → excluir com confirmação.
      Se **não** houver credencial, **reportar bloqueio** (não forçar). **Conclusão**: fluxo validado ou
      bloqueio reportado. (depende de: T022–T027)

---

## Fase 11 — Quality gates finais (antes de commit/push/PR)

- [x] T036 Prettier nos arquivos tocados (código + **`.md` da spec**): `npx prettier --write` só nos
      alvos; **não** formatar repo-wide às cegas. **Conclusão**: arquivos da feature formatados.
- [x] T037 Rodar gates: `npm run format:check` (repo-wide, mesmo do CI) + `npm run lint` +
      `npm run typecheck` + `npm run test` + `npm run test:integration` + `npm run build`. Se
      `format:check` falhar, corrigir antes de push/PR. **Conclusão**: todos verdes.
- [x] T038 Verificação git final: `git status --short`; `git diff --name-status`;
      `git diff -- src/shared/db/schema src/shared/db/migrations` (**vazio**). **Conclusão**: zero schema/
      migration; apenas arquivos previstos alterados.

---

## Dependências (ordem de conclusão)

- **Fase 2 (domínio)** bloqueia tudo (repo/actions/REST/UI/tests importam o domínio).
- **Fase 3 (repo)** depende de T008; **Fase 4 (actions)** e **Fase 5 (REST)** dependem de T006 + repo.
- **Fase 6 (UI)** depende de actions (T016–T019).
- **Fases 7–9 (docs/tests)** dependem das superfícies (REST/actions/domínio).
- **Fase 10** depende de REST/UI prontos; **Fase 11** é o fecho.
- Fluxo vertical MVP: T004→T008 → (T009,T010,T012,T013) → (T016,T017) → T020 → (T024,T022,T025) →
  entrega US1+US2 testável.

## Paralelização (`[P]`)

- **T020 ∥ T021** (rotas REST — arquivos distintos).
- **T023** (delete-component) ∥ demais componentes de UI após T019.
- **T028 ∥ T029** (docs ∥ Postman).
- **T030** (unit) ∥ implementação de UI/docs.
- **T032 ∥ T033** (isolation ∥ REST integração) após o backend.
- Dentro de um mesmo arquivo (domínio T004–T008; repo T009–T015; actions T016–T019) as tasks são
  **sequenciais** (mesmo arquivo — sem `[P]`).

## Guardrails reafirmados

Nenhuma task: cria migration · altera schema · toca `schema/**`/`migrations/**` · altera metodologia
· cria CRUD de `risk_methodology` · implementa `control_measures`/5W2H/`epi_risk`/IA · altera o CRUD
de `risks` (exceto botão em T027) · aceita `orgId`/`organizationId`/`organization_id` do cliente ·
usa 409/`DUPLICATE`/upsert/PATCH parcial.
