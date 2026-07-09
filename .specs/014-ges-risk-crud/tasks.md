---
description: "Task list — CRUD de Risco do GES (014)"
---

# Tasks: CRUD de Risco do GES

**Input**: Design documents from `.specs/014-ges-risk-crud/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Branch**: `feature/ges-risk-crud` · **Zero-migration** (não tocar `schema/**` nem `migrations/**`)

**Tests**: incluídos e **obrigatórios** (constituição v1.2.1 + spec) — unit + integração em Postgres
efêmero (`INTEGRATION_*`, nunca SQLite) + validação manual (Playwright MCP + cURL) antes da PR.

## Formato: `[ID] [P?] [Story?] Descrição com caminho de arquivo`

- **[P]**: paralelizável (arquivo distinto, sem dependência pendente).
- **[Story]**: US1 = CRUD do risco (P1) · US2 = filtro dependente Empresa→Obra→GES (P2) · US3 =
  reutilizar risco por prefill (P2).

> **Estrutura**: por ser um CRUD de entidade única cujas "stories" são facetas do mesmo backend, as
> fases seguem a **ordem em camadas** dirigida pelo Tech Lead (domínio → testes → repo → actions →
> REST → UI → docs → manual → gates); cada task recebe a tag de story a que serve. MVP = **US1**.

## Guardrails invariantes (valem para toda task)

- Tenant sempre de `requireOfficeStaff()`/bypass dev; nunca de `orgId`/`organizationId`/
  `organization_id` de input do cliente.
- Repository concentra Drizzle + `withOrg` + `eq(risks.orgId, …)`; Server Actions/handlers **não**
  importam Drizzle. `logTenantEvent` só em create/update/delete (via `officeAction {audit:true}` +
  `auditedTenantWrite`), sem PII.
- **Zero-migration**; escopo somente nas colunas reais de `risks`; **não** tocar `risk_assessments`,
  `control_measures`, `epi_risk`, IA, metodologia nem hierarquia de controles em UI.
- Update é **corpo completo** (não PATCH parcial); **sem** `created_by`; **sem** action de clone.
- Erros: risco próprio cross-tenant/inexistente (get/update/delete) → `NOT_FOUND`/404; `gesId`
  inválido/cross-tenant → `FK_NOT_FOUND`/422; validação → 422; `client` → 403; **nunca**
  `DUPLICATE`/409.
- Nomenclatura: tabela real é **`risks`** (nunca `riscos`); domínio novo é `domains/pgr/risk.ts`
  (singular), que **importa** os enums/labels de `domains/pgr/risks.ts` (plural, existente) sem
  redefini-los.

---

## Phase 1: Setup & Guardrails

- [x] T001 Confirmar branch `feature/ges-risk-crud` e árvore limpa; reafirmar zero-migration (nenhuma edição em `src/shared/db/schema/**` ou `src/shared/db/migrations/**` em toda a fatia)
- [x] T002 [P] Confirmar (read-only) que `src/__tests__/integration/_helpers/pgr-seed.ts` já semeia `risks` por tenant (`PGR_IDS.riskA`/`riskB`, cols `id,org_id,ges_id,agent_type,description`); estender o insert **somente** se um teste exigir campos opcionais (preferir criar via `createRiskAction`). Reler os padrões reais `repositories/pgr.ts`, `actions/pgr/pgr.ts`, `repositories/ges.ts` como referência

---

## Phase 2: Domínio / Zod (Foundational) — bloqueia todas as stories

- [x] T003 [US1] Criar `src/shared/domains/pgr/risk.ts`: imports (`riskAgentTypeSchema`, `exposureTimeSchema`, `measurementUnitSchema` + labels/tipos de `./risks`; `optionalString`, `requiredString`, `requiredUuid` de `./form-fields`; `z`); re-export `type Risk` de `@/shared/db/schema/risks`; helper `optionalEnum(schema)` (`""`→`undefined`, espelha `optionalUuid`); `optionalDecimal` (`optionalString` + refine `^\d+(\.\d+)?$`); `riskBaseObject` (gesId, agentType, hazard?, description, sources?, propagation?, exposureTime?, possibleInjuries?, noxiousAgentCode?, measurementUnit?, concentrationIntensity?)
- [x] T004 [US1] Em `src/shared/domains/pgr/risk.ts`: função `refineRisk` (**regra `qualitative_na`**: se `concentrationIntensity != null` e `measurementUnit` é `qualitative_na` **ou** ausente → issue em `concentrationIntensity`); `export const riskInputSchema = riskBaseObject.superRefine(refineRisk)` (**único** p/ create e update); tipos `RiskInput`/`RiskValues` (sem `any`)
- [x] T005 [US1] Em `src/shared/domains/pgr/risk.ts`: tipo `RiskListItem` (id, gesId, gesName, agentType, description, exposureTime, measurementUnit)
- [x] T006 [P] [US2] **Somente se a UI exibir a unidade com rótulo pt-BR**: adicionar `measurementUnitLabel(value)` como export **aditivo** em `src/shared/domains/pgr/risks.ts` (não é schema de banco; não redefinir enums; não tocar `db/schema/**`). Caso a UI use o value do enum, pular esta task

---

## Phase 3: Testes unitários do domínio (arquivo único — sequenciais) [US1]

- [x] T007 [US1] Criar `src/__tests__/unit/domains/pgr/risk.test.ts` + casos **create válido** e **update corpo completo** (`riskInputSchema.parse({gesId, agentType:"physical", description:"…"})` resolve; opcionais omitidos → `undefined`)
- [x] T008 [US1] Caso **`gesId` inválido** (`gesId:"x"` → throw, campo `gesId`) em `risk.test.ts`
- [x] T009 [US1] Casos **campos obrigatórios** (`agentType` ausente → throw; `description:""` → throw) em `risk.test.ts`
- [x] T010 [US1] Caso **enum inválido** (`agentType`/`exposureTime`/`measurementUnit` fora do conjunto → throw) em `risk.test.ts`
- [x] T011 [US1] Casos **`qualitative_na` com concentração** (`measurementUnit:"qualitative_na", concentrationIntensity:"5"` → throw) e **concentração sem unidade** (concentração sem `measurementUnit` → throw), campo `concentrationIntensity`, em `risk.test.ts`
- [x] T012 [US1] Caso **unidade quantitativa com concentração** (`measurementUnit:"db_a", concentrationIntensity:"87.5"` → resolve) em `risk.test.ts`
- [x] T013 [US1] Casos **concentração ausente válida** (sem `concentrationIntensity`, mesmo com `qualitative_na` → resolve) e **enum vazio** (`exposureTime:""`/`measurementUnit:""` → `undefined`) em `risk.test.ts`
- [x] T014 [US1] Caso **decimal inválido** (`measurementUnit:"db_a", concentrationIntensity:"abc"` → throw, campo `concentrationIntensity`) em `risk.test.ts`

---

## Phase 4: Repository (Drizzle + withOrg) [US1]

- [x] T015 [US1] Criar `src/shared/db/repositories/risks.ts`: `"server-only"` + imports (drizzle `and`/`desc`/`eq`/`ilike`/`sql`/`SQL`, `RiskValues`/`RiskListItem` de `@/shared/domains/pgr/risk`, pagination, `ReferenceNotFoundError`, `withOrg`/`TenantTransaction`, schemas `risks`/`ges`, `auditedTenantWrite`); tipo `ListRisksParams` (companyId?/workUnitId?/gesId?/search?); mapper `toRiskColumns` (`?? null` nos opcionais; `concentrationIntensity` string|null); guard privado `assertGesInTenant(tx, orgId, gesId)` → `ReferenceNotFoundError("ges")`
- [x] T016 [US1] Implementar `listRisks` em `repositories/risks.ts`: `withOrg`; filtros `eq(risks.orgId)` + `eq(risks.gesId, gesId?)` + `eq(ges.companyId, companyId?)`/`eq(ges.workUnitId, workUnitId?)` (via join) + `ilike(risks.description, %search%)`; `innerJoin(ges, and(eq(ges.id, risks.gesId), eq(ges.orgId, orgId)))`; projeção `RiskListItem` (`gesName: ges.name`); `orderBy(desc(risks.createdAt))`; `count(*)::int` com o **mesmo** `where` e o **mesmo** `innerJoin(ges)`; retorna `{rows,total}`
- [x] T017 [US1] Implementar `getRiskById` em `repositories/risks.ts` (`withOrg`, `and(eq(orgId),eq(id))`, `row ?? null`, sem join)
- [x] T018 [US1] Implementar `createRisk` em `repositories/risks.ts` (`auditedTenantWrite("risks.write_rejected")`+`withOrg`; `await assertGesInTenant(tx,orgId,input.gesId)` ANTES; `insert(risks).values({orgId, ...toRiskColumns})…returning()`)
- [x] T019 [US1] Implementar `updateRisk` em `repositories/risks.ts` (mesmo guard `assertGesInTenant`; `update set {...toRiskColumns, updatedAt:new Date()} where org+id returning`; `row ?? null`)
- [x] T020 [US1] Implementar `deleteRisk` em `repositories/risks.ts` (`delete…returning({id}) → rows.length>0`; cascata de `risk_assessments`/`control_measures` é do banco, **não tocar**)

---

## Phase 5: Server Actions (sem Drizzle) [US1]

- [x] T021 [US1] Criar `src/shared/server/actions/pgr/risks.ts` (`"use server"`): imports, `BASE_PATH="/risks"`, `listRisksAction` (`pgr.risks.list`, sem audit), `getRiskAction` (`pgr.risks.get`, null→`NotFoundError`) — **nome `getRiskAction`** (não `getRiskByIdAction`)
- [x] T022 [US1] `createRiskAction` em `actions/pgr/risks.ts`: `riskInputSchema.parse(input)` → `repo.createRisk` → `revalidatePath(BASE_PATH)` → `{audit:true}`
- [x] T023 [US1] `updateRiskAction` em `actions/pgr/risks.ts`: `riskInputSchema.parse(input)` (corpo completo) → `repo.updateRisk` → null→`NotFoundError` → revalida `BASE_PATH` + `/${id}` + `/${id}/edit` → `{audit:true}`
- [x] T024 [US1] `deleteRiskAction` em `actions/pgr/risks.ts`: `repo.deleteRisk` → false→`NotFoundError` → `revalidatePath(BASE_PATH)` → `{audit:true}` → retorna `{id}`

---

## Phase 6: Integração — Server Actions (Postgres efêmero) [US1]

- [x] T025 [US1] Criar harness `src/__tests__/integration/risks/risks.test.ts`: mocks `@/shared/db/env` (`getDatabaseUrl→INTEGRATION_APP_RUNTIME_URL`), `next/cache`, `requireOfficeStaff`; `shouldRun`; `asOwner`; `beforeAll: applyMigrations`; `beforeEach: seedPgrBase`. Rodar com `--runInBand` (suítes compartilham a DB)
- [x] T026 [US1] Casos **list** (só tenant, `total===1`, `gesName==="GES A"`) e **getById** (`PGR_IDS.riskA`, `gesId===PGR_IDS.gesA`) em `risks.test.ts`
- [x] T027 [US1] Casos **create válido** (ok, aparece na lista) e **create com unidade quantitativa + concentração** (ok) em `risks.test.ts`
- [x] T028 [US1] Casos **create `qualitative_na` + concentração** → `VALIDATION` (`fields.concentrationIntensity`) e **create sem `agentType`/`description`** → `VALIDATION` em `risks.test.ts`
- [x] T029 [US1] Casos **update** (`riskA`, corpo completo) e **delete** (`riskA`, depois `getById`→`NOT_FOUND`) em `risks.test.ts`
- [x] T030 [US1] Caso **cross-tenant get/update/delete** (`PGR_IDS.riskB` agindo como `org_a`) → `NOT_FOUND` (3 casos) em `risks.test.ts`
- [x] T031 [US1] Caso **outro tenant não aparece na lista** (org_a não vê `riskB`) em `risks.test.ts`
- [x] T032 [US1] Casos **FK_NOT_FOUND**: `gesId` inválido (uuid aleatório) e `gesId` cross-tenant (`gesB` agindo como `org_a`) no create/update em `risks.test.ts`
- [x] T033 [US1] Caso **role client → FORBIDDEN** (`mockedGate.mockRejectedValue(new ForbiddenError())`) em `risks.test.ts`
- [x] T034 [P] [US1] Criar `src/__tests__/integration/risks/risks-isolation.test.ts` — `runIsolationSuite({ table:"risks", seededCountA:1, crossTenantInsertSql:"insert into public.risks (id,org_id,ges_id,agent_type,description) values ('…f8','org_b', PGR_IDS.gesB, 'physical','x')" })` (RLS backstop)

---

## Phase 7: REST Route Handlers [US1]

- [x] T035 [US1] Criar `src/app/api/v1/risks/route.ts` (`runtime="nodejs"`, `dynamic="force-dynamic"`): `GET` (list via `pageParamsFrom` + `companyId`/`workUnitId`/`gesId`/`search` da query); `POST` (`riskInputSchema.parse(await req.json())` → `repo.createRisk`, `{status:201}`)
- [x] T036 [US1] Criar `src/app/api/v1/risks/[id]/route.ts` (`params: Promise<{id}>`): `GET` (null→`NotFoundError`); `PUT` (`riskInputSchema.parse`, corpo completo; null→`NotFoundError`); `DELETE` (`{status:204}`)

---

## Phase 8: Integração — REST (bypass dev) [US1]

- [x] T037 [US1] Criar harness `src/__tests__/integration/risks/rest-risks.test.ts`: `beforeAll` `APP_ENV="local"`+`DEV_API_AUTH_BYPASS="true"`; helper `req({method,body,role,tenant,query})` com headers `x-dev-tenant`/`x-dev-role`; importar handlers de `risks/route` e `risks/[id]/route` (`{ params: Promise.resolve({ id }) }`)
- [x] T038 [US1] Casos **GET list 200** (`body.total===1`), **POST create 201**, **GET/{id} 200** em `rest-risks.test.ts`
- [x] T039 [US1] Casos **POST sem `description`/`agentType` → 422** `VALIDATION` e **POST `qualitative_na`+concentração → 422** `VALIDATION` em `rest-risks.test.ts`
- [x] T040 [US1] Caso **POST `gesId` inválido/cross-tenant → 422** `FK_NOT_FOUND` em `rest-risks.test.ts`
- [x] T041 [US1] Casos **PUT 200**, **DELETE 204**, e **GET/PUT/DELETE de `riskB` (tenant org_a) → 404** em `rest-risks.test.ts`
- [x] T042 [US1] Casos **role `client` → 403** e **assert nunca 409** em `rest-risks.test.ts`

> Nota (herdada da 013): se o harness REST-via-jest tiver limitação de ambiente pré-existente,
> validar o REST por cURL contra o dev server (Phase 11) e registrar — não é bug da fatia.

---

## Phase 9: UI — `/risks` (reuso de `_ui`) [US1/US2/US3]

- [x] T043 [US1] Criar `src/app/(protected)/risks/page.tsx` (server, `force-dynamic`): `requireOfficeStaffPage()`, `listRisksAction`, `Table` cols **Grupo do agente·Descrição·Tempo de exposição·GES·Opções** (labels via `riskAgentTypeLabel`/`exposureTimeLabel`), `EmptyState` orientando 1º risco, `PrimaryLink` "Novo", `Pagination`
- [x] T044 [US2] Criar `src/app/(protected)/risks/_components/risk-filters.tsx` (client): cascata **Empresa→Obra→GES** (obras via `listWorkUnitsAction({companyId,pageSize:100})`; GES via `listGesAction({workUnitId,pageSize:100})`; **trocar Empresa reseta Obra e GES**; **trocar Obra reseta GES** — resetar no handler, não em `useEffect`, p/ evitar `set-state-in-effect`) navegando por query params; integrar em `page.tsx`
- [x] T045 [US1] Criar `src/app/(protected)/risks/_components/risk-form.tsx` (client): cascata **Empresa→Obra→GES** com **`gesId` obrigatório** no create; `SelectField` de `agentType` (obrigatório), `description` (obrigatório), `exposureTime`/`measurementUnit` (opcionais, com opção vazia), `hazard`/`sources`/`propagation`/`possibleInjuries`/`noxiousAgentCode` (texto), `concentrationIntensity` (texto `inputMode="decimal"`); chama `create`/`update`; mapeia `result.error.fields` (inclui `concentrationIntensity` da regra `qualitative_na`); `router.push("/risks")`+`refresh` no sucesso
- [x] T046 [US3] Criar `src/app/(protected)/risks/new/page.tsx`: `requireOfficeStaffPage()`, `listCompanyOptionsAction()`; **se `searchParams.from`** → `getRiskAction(from)` e passar valores como `defaultValues` ao `<RiskForm>` (prefill de reutilização; `gesId` de origem preenchido e **editável**); submit usa `createRiskAction` (novo `id`, **sem** clone server-side, **sem** checagem de duplicidade)
- [x] T047 [US1] Criar `src/app/(protected)/risks/[id]/page.tsx` (detalhe read-only): `getRiskAction` (notFound), resolve nome do GES via `getGesAction(gesId)`, `Field`s com labels pt-BR dos enums, ações **Editar** + **Reutilizar** (link `/risks/new?from=<id>`, US3) + `<DeleteRisk redirectTo="/risks">`
- [x] T048 [US1] Criar `src/app/(protected)/risks/[id]/edit/page.tsx`: `getRiskAction` (notFound), `listCompanyOptionsAction()` → `<RiskForm risk={…} companies={…} />` (corpo completo)
- [x] T049 [US1] Criar `src/app/(protected)/risks/_components/delete-risk.tsx`: wrapper de `ConfirmDeleteButton` (`deleteRiskAction`, `entityName="Risco"`, `description` estática sobre cascata de avaliações/medidas futuras; **sem** `loadDependentsAction`)
- [x] T050 [US1] Editar `src/app/(protected)/layout.tsx`: adicionar `{ href: "/risks", label: "Riscos" }` ao array `PGR_NAV`

---

## Phase 10: Docs & Postman

- [x] T051 [P] Atualizar `docs/api/api-design.md`: linha na tabela de recursos REST (`/risks` · `/risks/{id}` → GET,POST · GET,PUT,DELETE), linha no sumário de actions (`Riscos | actions/pgr/risks.ts | list,get,create,update,delete`), seção `## Riscos — actions/pgr/risks.ts` (tabela de actions + blocos `RiskInput`/`RiskListItem`), linha nas Rotas de UI (`/risks`·`/risks/new`·`/risks/[id]`·`/risks/[id]/edit`); documentar erros **403/404/422** e **ausência de 409**
- [x] T052 [P] Atualizar `docs/api/sst-manager.postman_collection.json`: variável `{ "key":"riskId","value":"" }` + pasta **"Riscos"** (GET list `?companyId=&workUnitId=&gesId=&page=1&pageSize=20`; POST create body completo; GET `/{{riskId}}`; PUT `/{{riskId}}` corpo completo; DELETE `/{{riskId}}`) com headers `x-dev-tenant`/`x-dev-role` (+ `Content-Type` nas escritas); incluir exemplos 403/404/422; **sem** 409

---

## Phase 11: Validação manual (obrigatória antes da PR)

- [ ] T053 [US1] **Playwright MCP** (`npm run dev`): abrir `/risks` (estado vazio → criar → lista), criar risco (Empresa→Obra→**GES obrigatório**, grupo do agente, descrição), detalhar, editar (corpo completo), excluir com confirmação; validar mensagens de erro (obrigatórios; **concentração com `qualitative_na` rejeitada**, com unidade quantitativa aceita) e navegação (nav "Riscos"/Novo/voltar)
- [ ] T054 [US2] **Playwright MCP**: validar **filtro Empresa→Obra→GES** — selecionar Empresa reduz Obras; selecionar Obra reduz GES; **trocar Empresa reseta Obra e GES**; **trocar Obra reseta GES**; lista reflete os filtros
- [ ] T055 [US3] **Playwright MCP**: **Reutilizar** um risco (detalhe/linha) → abre `/risks/new?from=<id>` pré-preenchido; escolher **outro GES** de destino → criar → novo risco (novo id); risco de origem permanece inalterado; sem erro de duplicidade
- [ ] T056 [US1] **cURL** (`APP_ENV≠production` + `DEV_API_AUTH_BYPASS=true`, usar `-d @arquivo.json`): registrar o **tenant** usado e confirmar GES/company/workUnit de teste desse tenant; `GET /api/v1/risks`, `POST` (gesId+agentType+description), `GET /{id}`, `PUT /{id}` (corpo completo), `DELETE /{id}`; validar **201/200/204** no feliz, **422** (obrigatórios/`qualitative_na`/FK `gesId`), **404** (cross-tenant), **403** (`x-dev-role:client`), **nunca 409**; **criar e apagar** o risco de teste ao final; **não** imprimir segredos

---

## Phase 12: Quality Gates & Polish

- [x] T057 Rodar `npm run format` nos arquivos tocados e `npm run format:check`
- [x] T058 Rodar `npm run lint`
- [x] T059 Rodar `npm run typecheck` (`npx tsc --noEmit`)
- [x] T060 Rodar `npm run test` (unit — inclui `risk.test.ts`)
- [ ] T061 Rodar `npm run test:integration` (Postgres efêmero `INTEGRATION_*` — `risks.test.ts`, `rest-risks.test.ts`, `risks-isolation.test.ts`; usar `--runInBand`)
- [x] T062 [P] Rodar `npm run build` (sanity de build Next)
- [x] T063 Validar `git status --short`, `git diff --name-status` e `git diff -- src/shared/db/schema src/shared/db/migrations`: apenas arquivos esperados; **nada** em `src/shared/db/schema/**` ou `src/shared/db/migrations/**` (verificação final de zero-migration)

---

## Dependências entre fases

- **Phase 2 (domínio)** bloqueia tudo (repo/actions/REST/UI/testes importam os schemas/tipos). T006
  (`measurementUnitLabel`) é opcional e só necessário se a UI usar rótulo pt-BR de unidade.
- **Phase 4 (repo)** depende de 2; **Phase 5 (actions)** depende de 4; **Phase 7 (REST)** depende de
  4 (+ `riskInputSchema` de 2).
- **Phase 6 (int. actions)** depende de 5; **Phase 8 (int. REST)** depende de 7.
- **Phase 9 (UI)** depende de 5 (actions) e reusa `listCompanyOptionsAction`/`listWorkUnitsAction`/
  `listGesAction`/`getGesAction` existentes; `risk-form` (T045) precede `new`/`edit` (T046/T048);
  o prefill de reuso (T046, US3) depende de `getRiskAction` (T021) + `risk-form` (T045).
- **Phase 10 (docs/Postman)** depende de 7 (contrato REST estável).
- **Phase 11 (manual)** depende de 9 + 7 prontos; **Phase 12 (gates)** por último.

## Oportunidades de paralelismo ([P])

- T002 (leitura da seed/padrões) paralela ao início do domínio.
- T006 (`measurementUnitLabel` em `risks.ts`) é arquivo distinto de `risk.ts` → paralela a T003–T005.
- T034 (`risks-isolation.test.ts`) é arquivo próprio → paralela às demais suítes de integração.
- T051 e T052 (docs e Postman) são arquivos distintos → paralelas entre si.
- T062 (`build`) paralelo aos demais gates de leitura.
- Observação: os casos de teste dentro de um **mesmo arquivo** (T007–T014; T026–T033; T038–T042)
  **não** são `[P]` entre si (editam o mesmo arquivo) — executar em sequência.

## Estratégia de entrega (MVP incremental)

1. **MVP = US1** (P1): backend (Phases 2–8) + UI CRUD (Phase 9, exceto filtro dependente e reuso) →
   risco criável/listável/detalhável/editável/excluível por GES, isolado por tenant, com a regra
   `qualitative_na` validada no servidor. Demonstrável e testável isolado.
2. **US2** (P2): filtro dependente Empresa→Obra→GES (T044 + casos de filtro no manual).
3. **US3** (P2): reutilização por prefill (T046 prefill + botão "Reutilizar" em T047 + T055).
4. **Fechamento**: docs/Postman (Phase 10) + manual (Phase 11) + gates (Phase 12) antes da PR.

## Story breakdown

- **US1 — CRUD do risco (P1)**: T003–T005, T007–T043, T045, T047–T050, T053, T056 → núcleo
  backend+UI+testes.
- **US2 — Filtro dependente Empresa→Obra→GES (P2)**: T006 (label opcional), T044, T054.
- **US3 — Reutilizar risco por prefill (P2)**: T046 (prefill `?from=`), T047 (botão Reutilizar),
  T055.

## Restrições reafirmadas

Não implementar código agora (apenas o `tasks.md`). Nenhuma migration; escopo somente nas colunas de
`risks`. Não tocar `risk_assessments`/`control_measures`/`epi_risk`/schema/migrations. Sem
`DUPLICATE`/409, sem PATCH parcial, sem `created_by`, sem clone server-side, sem tenant vindo do
cliente. Nenhum commit manual/push/PR.
