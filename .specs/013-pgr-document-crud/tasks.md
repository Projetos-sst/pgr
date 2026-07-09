---
description: "Task list — CRUD do Documento PGR (013)"
---

# Tasks: CRUD do Documento PGR

**Input**: Design documents from `.specs/013-pgr-document-crud/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Branch**: `feature/pgr-document-crud` · **Zero-migration** (não tocar `schema/**` nem `migrations/**`)

**Tests**: incluídos e **obrigatórios** (constituição v1.2.1 + spec) — unit + integração em Postgres
efêmero (`INTEGRATION_*`, nunca SQLite) + validação manual (Playwright MCP + cURL) antes da PR.

## Formato: `[ID] [P?] [Story?] Descrição com caminho de arquivo`

- **[P]**: paralelizável (arquivo distinto, sem dependência pendente).
- **[Story]**: US1 = CRUD do documento (P1) · US2 = aceite da Declaração NR-01 (P1) · US3 = filtro
  dependente Empresa→Obra (P2).

> **Estrutura**: por ser um CRUD de entidade única cujas "stories" são facetas do mesmo backend, as
> fases seguem a **ordem em camadas** dirigida pelo Tech Lead (domínio → testes → repo → actions →
> REST → UI → docs → manual → gates); cada task recebe a tag de story a que serve. MVP = **US1 + US2**.

## Guardrails invariantes (valem para toda task)

- Tenant sempre de `requireOfficeStaff()`/bypass dev; nunca de input do cliente.
- Repository concentra Drizzle + `withOrg` + `eq(pgr.orgId, …)`; Server Actions/handlers **não**
  importam Drizzle. `logTenantEvent` só em create/update/delete (via `officeAction {audit:true}` +
  `auditedTenantWrite`), sem PII.
- **Zero-migration**; não tocar `pgr_ges`/`pgr_revisions`/`risks`/`risk_assessments`/`control_measures`.
- Erros: PGR próprio cross-tenant/inexistente (get/update/delete) → `NOT_FOUND`/404; FK empresa/obra
  inválida/cross-tenant/obra-de-outra-empresa → `FK_NOT_FOUND`/422; validação → 422; `client` → 403;
  **nunca** `DUPLICATE`/409.

---

## Phase 1: Setup & Guardrails

- [x] T001 Confirmar branch `feature/pgr-document-crud` e árvore limpa; reafirmar zero-migration (nenhuma edição em `src/shared/db/schema/**` ou `src/shared/db/migrations/**` em toda a fatia)
- [x] T002 [P] Confirmar (read-only) que `src/__tests__/integration/_helpers/pgr-seed.ts` já semeia `pgr` por tenant (`PGR_IDS.pgrA`/`pgrB`); estender o insert **somente** se um teste exigir `responsible`/`registration_type`/datas (preferir criar via `createPgrAction`)

---

## Phase 2: Domínio / Zod (Foundational) — bloqueia todas as stories

- [x] T003 [US1] Criar `src/shared/domains/pgr/pgr.ts`: imports (`pgrRegistrationTypeSchema`, `pgrRegistrationTypeLabel` de `./risks`; `requiredUuid`, `optionalUuid`, `optionalString` de `./form-fields`; `z`), helper `requiredIsoDate(msg)= z.iso.date(msg)`, e `pgrBaseObject` (companyId, workUnitId?, responsible?, registrationType, registrationNumber?, issuedAt, validUntil)
- [x] T004 [US1] Em `src/shared/domains/pgr/pgr.ts`: função `refinePgr` (tipo↔número: obrigatório p/ crm/crea/mte, vazio p/ not_applicable; `validUntil >= issuedAt`) e `export const pgrInputSchema = pgrBaseObject.superRefine(refinePgr)`; tipos `PgrInput`/`PgrValues` (sem `any`)
- [x] T005 [US2] Em `src/shared/domains/pgr/pgr.ts`: `export const pgrCreateSchema = pgrBaseObject.extend({ declarationAccepted: z.literal(true, { error: "É necessário aceitar a Declaração de Ciência de Riscos (NR-01)…" }) }).superRefine(refinePgr)`; tipo `PgrCreateInput`
- [x] T006 [US1] Em `src/shared/domains/pgr/pgr.ts`: tipo `PgrListItem` (id, companyId, companyName, workUnitId, workUnitName, responsible, registrationType, registrationNumber, issuedAt, validUntil)

---

## Phase 3: Testes unitários do domínio (arquivo único — sequenciais)

- [x] T007 [US1] Criar `src/__tests__/unit/domains/pgr/pgr.test.ts` + caso **create válido** (`pgrCreateSchema.parse` com `declarationAccepted:true` resolve; valores coeridos)
- [x] T008 [US2] Caso **create sem aceite** → `.toThrow()` (VALIDATION em `declarationAccepted`) em `pgr.test.ts`
- [x] T009 [US1] Caso **validade < emissão** (`validUntil<issuedAt`) → throw (campo `validUntil`) em `pgr.test.ts`
- [x] T010 [US1] Caso **tipo↔número**: `crm/crea/mte` sem número → throw; `not_applicable` com número → throw em `pgr.test.ts`
- [x] T011 [US1] Caso **update corpo completo sem aceite** (`pgrInputSchema.parse` de corpo válido) resolve; em `pgr.test.ts`
- [x] T012 [US1] Caso **UUID inválido** (`companyId:"x"` → throw); `workUnitId:""`/`responsible:""` → `undefined` em `pgr.test.ts`

---

## Phase 4: Repository (Drizzle + withOrg) [US1]

- [x] T013 [US1] Criar `src/shared/db/repositories/pgr.ts`: `"server-only"` + imports (drizzle, `PgrValues`/`PgrListItem`, pagination, `ReferenceNotFoundError`, `withOrg`/`TenantTransaction`, schemas `pgr`/`companies`/`workUnits`, `auditedTenantWrite`); tipo `ListPgrParams`; mapper `toPgrColumns` (`?? null` nos opcionais); guards `assertCompanyInTenant` e `assertWorkUnitInCompany`
- [x] T014 [US1] Implementar `listPgr` em `repositories/pgr.ts`: `withOrg`; filtros `eq(pgr.orgId)` + `companyId?`/`workUnitId?` + `ilike(pgr.responsible)` se `search`; `innerJoin(companies)` + `leftJoin(workUnits)`; projeção `PgrListItem`; `orderBy(desc(pgr.createdAt))`; `count(*)::int`; `{rows,total}`
- [x] T015 [US1] Implementar `getPgrById` em `repositories/pgr.ts` (`withOrg`, `and(eq(orgId),eq(id))`, `row ?? null`)
- [x] T016 [US1] Implementar `createPgr` em `repositories/pgr.ts` (`auditedTenantWrite("pgr.write_rejected")`+`withOrg`; `assertCompanyInTenant`; se `workUnitId` → `assertWorkUnitInCompany`; `insert…returning()`)
- [x] T017 [US1] Implementar `updatePgr` em `repositories/pgr.ts` (mesmos guards; `update set {...toPgrColumns, updatedAt:new Date()} where org+id returning`; `row ?? null`)
- [x] T018 [US1] Implementar `deletePgr` em `repositories/pgr.ts` (`delete…returning({id}) → rows.length>0`; cascata de `pgr_ges`/`pgr_revisions` é do banco, não tocar)

---

## Phase 5: Server Actions (sem Drizzle) [US1/US2]

- [x] T019 [US1] Criar `src/shared/server/actions/pgr/pgr.ts` (`"use server"`): imports, `BASE_PATH="/pgr"`, `listPgrAction` (`pgr.pgr.list`, sem audit), `getPgrAction` (`pgr.pgr.get`, null→`NotFoundError`) — **nome `getPgrAction`** (não `getPgrByIdAction`)
- [x] T020 [US2] `createPgrAction` em `actions/pgr/pgr.ts`: `pgrCreateSchema.parse` → `const { declarationAccepted:_a, ...values } = parsed` (não persistido) → `repo.createPgr` → `revalidatePath(BASE_PATH)` → `{audit:true}`
- [x] T021 [US1] `updatePgrAction` em `actions/pgr/pgr.ts`: `pgrInputSchema.parse` (corpo completo, sem aceite) → `repo.updatePgr` → null→`NotFoundError` → revalida `BASE_PATH` + `/${id}` + `/${id}/edit` → `{audit:true}`
- [x] T022 [US1] `deletePgrAction` em `actions/pgr/pgr.ts`: `repo.deletePgr` → false→`NotFoundError` → `revalidatePath(BASE_PATH)` → `{audit:true}` → retorna `{id}`

---

## Phase 6: Integração — Server Actions (Postgres efêmero)

- [x] T023 [US1] Criar harness `src/__tests__/integration/pgr/pgr.test.ts`: mocks `@/shared/db/env` (`getDatabaseUrl→INTEGRATION_APP_RUNTIME_URL`), `next/cache`, `requireOfficeStaff`; `shouldRun`; `asOwner`; `beforeAll: applyMigrations`; `beforeEach: seedPgrBase`
- [x] T024 [US1] Casos **list** (só tenant, `total`, `companyName`) e **getById** (`PGR_IDS.pgrA`) em `pgr.test.ts`
- [x] T025 [US2] Casos **create com aceite** (ok, aparece na lista) e **create sem aceite** → `VALIDATION` (`fields.declarationAccepted`) em `pgr.test.ts`
- [x] T026 [US1] Casos **update** (`pgrA`) e **delete** (`pgrA`, depois `getById`→`NOT_FOUND`) em `pgr.test.ts`
- [x] T027 [US1] Caso **cross-tenant get/update/delete** (`PGR_IDS.pgrB` agindo como `org_a`) → `NOT_FOUND` (P2-4) em `pgr.test.ts`
- [x] T028 [US1] Caso **outro tenant não aparece na lista** (org_a não vê `pgrB`) em `pgr.test.ts`
- [x] T029 [US1] Casos **FK_NOT_FOUND**: empresa inválida, obra inválida, **obra de outra empresa** (`companyA`+`workUnitB`), **empresa cross-tenant** (`companyB` como org_a) (P2-4) em `pgr.test.ts`
- [x] T030 [US1] Caso **role client → FORBIDDEN** (`mockedGate.mockRejectedValue(new ForbiddenError())`) em `pgr.test.ts`
- [x] T031 [P] [US1] Criar `src/__tests__/integration/pgr/pgr-isolation.test.ts` — `runIsolationSuite({ table:"pgr", seededCountA:1, crossTenantInsertSql:"insert into public.pgr (id,org_id,company_id,work_unit_id) values ('…f9','org_b', PGR_IDS.companyB, PGR_IDS.workUnitB)" })` (RLS backstop)

---

## Phase 7: REST Route Handlers [US1/US2]

- [x] T032 [US1] Criar `src/app/api/v1/pgr/route.ts` (`runtime="nodejs"`, `dynamic="force-dynamic"`): `GET` (list via `pageParamsFrom` + `companyId`/`workUnitId` da query); `POST` (`pgrCreateSchema.parse(await req.json())` → descarta `declarationAccepted` → `repo.createPgr`, `{status:201}`)
- [x] T033 [US1] Criar `src/app/api/v1/pgr/[id]/route.ts` (`params: Promise<{id}>`): `GET` (null→`NotFoundError`); `PUT` (`pgrInputSchema.parse`, corpo completo, sem aceite; null→`NotFoundError`); `DELETE` (`{status:204}`)

---

## Phase 8: Integração — REST (bypass dev)

- [x] T034 [US1] Criar harness `src/__tests__/integration/pgr/rest-pgr.test.ts`: `beforeAll` `APP_ENV="local"`+`DEV_API_AUTH_BYPASS="true"`; helper `req({method,body,role,tenant,query})` com headers `x-dev-tenant`/`x-dev-role`; importar handlers de `pgr/route` e `pgr/[id]/route`
- [x] T035 [US1] Casos **GET list 200**, **POST create 201**, **GET/{id} 200** em `rest-pgr.test.ts`
- [x] T036 [US2] Caso **POST sem aceite → 422** `VALIDATION` (e validade<emissão → 422) em `rest-pgr.test.ts`
- [x] T037 [US1] Casos **PUT 200**, **DELETE 204**, e **GET/PUT/DELETE de `pgrB` (tenant org_a) → 404** (P2-4) em `rest-pgr.test.ts`
- [x] T038 [US1] Casos **empresa/obra inválida → 422 FK_NOT_FOUND**, **role `client` → 403**, e **assert nunca 409** em `rest-pgr.test.ts` (P2-4)

---

## Phase 9: UI — `/pgr` (reuso de `_ui`) [US1/US2/US3]

- [x] T039 [US1] Criar `src/app/(protected)/pgr/page.tsx` (server, `force-dynamic`): `requireOfficeStaffPage()`, `listPgrAction`, `Table` cols **Emissão·Validade·Obra/Contrato·Empresa·Responsável·Opções**, `EmptyState` orientando 1º PGR, `PrimaryLink` "Novo", botão **"Metodologia de Avaliação" desabilitado** `title="Em breve (#76)"` sem navegação (P2-3), `Pagination`
- [x] T040 [US3] Criar `src/app/(protected)/pgr/_components/pgr-filters.tsx` (client): cascata Empresa→Obra (carrega obras via `listWorkUnitsAction({companyId,pageSize:100})`, reseta obra ao trocar empresa) navegando por query params; integrar em `page.tsx`
- [x] T041 [US1] Criar `src/app/(protected)/pgr/_components/pgr-form.tsx` (client): cascata Empresa→Obra; `SelectField` de `registrationType`; campos responsável/número/emissão/validade; chama `create`/`update`; mapeia `result.error.fields`; `router.push("/pgr")`+`refresh` no sucesso
- [x] T042 [US2] Criar `src/app/(protected)/pgr/_components/declaration-modal.tsx` (client, overlay estilo `confirm-delete-button`): texto NR-01 + checkbox + botão "Confirmar e prosseguir" habilitado só após aceite; no **create**, `pgr-form` abre o modal e só então chama `createPgrAction` com `declarationAccepted:true` (no **edit** não há gate)
- [x] T043 [US1] Criar `src/app/(protected)/pgr/new/page.tsx`: `requireOfficeStaffPage()`, `listCompanyOptionsAction()` → `<PgrForm companies={…} />`
- [x] T044 [US1] Criar `src/app/(protected)/pgr/[id]/page.tsx` (detalhe read-only): `getPgrAction` (notFound), resolve nomes empresa/obra em paralelo (`getCompanyAction`/`getWorkUnitAction`), `Field`s (rótulo do tipo via `pgrRegistrationTypeLabel`), ações **Editar** + `<DeletePgr redirectTo="/pgr">`, botão Metodologia desabilitado (P2-3)
- [x] T045 [US1] Criar `src/app/(protected)/pgr/[id]/edit/page.tsx`: `getPgrAction` (notFound), `listCompanyOptionsAction()` → `<PgrForm pgr={…} companies={…} />` (sem gate de declaração)
- [x] T046 [US1] Criar `src/app/(protected)/pgr/_components/delete-pgr.tsx`: wrapper de `ConfirmDeleteButton` (`deletePgrAction`, `entityName="PGR"`, `description` estática sobre cascata de vínculos futuros; **sem** `loadDependentsAction`)
- [x] T047 [US1] Editar `src/app/(protected)/layout.tsx`: adicionar `{ href: "/pgr", label: "PGR" }` ao array `PGR_NAV`

---

## Phase 10: Docs & Postman

- [x] T048 [P] Atualizar `docs/api/api-design.md`: linha na tabela de recursos REST (`/pgr` · `/pgr/{id}` → GET,POST · GET,PUT,DELETE), linha no sumário de actions (`PGR | actions/pgr/pgr.ts | list,get,create,update,delete`), seção `## PGR — actions/pgr/pgr.ts` (tabela de actions + blocos `PgrCreateInput`/`PgrInput`/`PgrListItem`), linha nas Rotas de UI (`/pgr`·`/pgr/new`·`/pgr/[id]`·`/pgr/[id]/edit`); documentar erros **403/404/422** e **ausência de 409**
- [x] T049 [P] Atualizar `docs/api/sst-manager.postman_collection.json`: variável `{ "key":"pgrId","value":"" }` + pasta **"PGR"** (GET list `?companyId=&workUnitId=&page=1&pageSize=20`; POST create body com `declarationAccepted:true`; GET `/{{pgrId}}`; PUT `/{{pgrId}}` corpo completo sem aceite; DELETE `/{{pgrId}}`) com headers `x-dev-tenant`/`x-dev-role` (+ `Content-Type` nas escritas)

---

## Phase 11: Validação manual (obrigatória antes da PR)

- [ ] T050 [US1] **Playwright MCP** (`npm run dev`): abrir `/pgr` (estado vazio → criar → lista), criar PGR com aceite, validar **filtro Empresa→Obra**, detalhar, editar (sem novo gate), excluir com confirmação, validar mensagens de erro (validade<emissão; número por tipo) e navegação (nav "PGR"/Novo/voltar)
- [ ] T051 [US2] **Playwright MCP**: tentar criar **sem aceitar** a Declaração — botão "Confirmar e prosseguir" desabilitado; se forçado, rejeição de validação do servidor
- [ ] T052 [US1] **cURL** (`APP_ENV≠production` + `DEV_API_AUTH_BYPASS=true`, usar `-d @arquivo.json`): `GET /api/v1/pgr`, `POST` (com `declarationAccepted:true`), `GET /{id}`, `PUT /{id}`, `DELETE /{id}`; validar **201/200/204** no feliz, **422** (sem aceite/validade/número/FK), **404** (cross-tenant), **403** (`x-dev-role:client`), **nunca 409**

---

## Phase 12: Quality Gates & Polish

- [x] T053 Rodar `npm run format` nos arquivos tocados e `npm run format:check`
- [x] T054 Rodar `npm run lint`
- [x] T055 Rodar `npm run typecheck`
- [x] T056 Rodar `npm run test` (unit — inclui `pgr.test.ts`)
- [ ] T057 Rodar `npm run test:integration` (Postgres efêmero `INTEGRATION_*` — `pgr.test.ts`, `rest-pgr.test.ts`, `pgr-isolation.test.ts`)
- [ ] T058 [P] Rodar `npm run build` (sanity de build Next)
- [x] T059 Validar `git status --short` e `git diff --name-status`: apenas arquivos esperados; **nada** em `src/shared/db/schema/**` ou `src/shared/db/migrations/**`

---

## Dependências entre fases

- **Phase 2 (domínio)** bloqueia tudo (repo/actions/REST/UI/testes importam os schemas/tipos).
- **Phase 4 (repo)** depende de 2; **Phase 5 (actions)** depende de 4; **Phase 7 (REST)** depende de
  4 (+ `pgrCreateSchema`/`pgrInputSchema` de 2).
- **Phase 6 (int. actions)** depende de 5; **Phase 8 (int. REST)** depende de 7.
- **Phase 9 (UI)** depende de 5 (actions) e reusa `listCompanyOptionsAction`/`listWorkUnitsAction`
  existentes; `declaration-modal`/`pgr-form` (T041/T042) precedem `new`/`edit` (T043/T045).
- **Phase 10 (docs/Postman)** depende de 7 (contrato REST estável).
- **Phase 11 (manual)** depende de 9 + 7 prontos; **Phase 12 (gates)** por último.

## Oportunidades de paralelismo ([P])

- T002 (leitura da seed) paralela ao início do domínio.
- T031 (`pgr-isolation.test.ts`) é arquivo próprio → paralela às demais suítes de integração.
- T048 e T049 (docs e Postman) são arquivos distintos → paralelas entre si.
- T058 (`build`) paralelo aos demais gates de leitura.
- Observação: os casos de teste dentro de um **mesmo arquivo** (T007–T012; T024–T030; T035–T038)
  **não** são `[P]` entre si (editam o mesmo arquivo) — executar em sequência.

## Estratégia de entrega (MVP incremental)

1. **MVP = US1 + US2** (P1): backend (Phases 2–8) + UI CRUD com gate de aceite (Phase 9, exceto
   filtro) → documento PGR criável/listável/detalhável/editável/excluível, com aceite validado no
   servidor. Demonstrável e testável isolado.
2. **US3** (P2): filtro dependente Empresa→Obra (T040 + casos de filtro) — incremento sobre a lista.
3. **Fechamento**: docs/Postman (Phase 10) + manual (Phase 11) + gates (Phase 12) antes da PR.

## Story breakdown

- **US1 — CRUD do documento (P1)**: T003–T004, T006, T007, T009–T024, T026–T038 (parcial), T039,
  T041, T043–T047, T050, T052 → núcleo backend+UI+testes.
- **US2 — Aceite da Declaração NR-01 (P1)**: T005, T008, T025, T036, T042, T051.
- **US3 — Filtro dependente Empresa→Obra (P2)**: T040 (+ asserção de filtro incluída em T024/T035).

## Restrições reafirmadas

Não implementar código agora (apenas o `tasks.md`). Nenhuma migration. Não tocar
`pgr_ges`/`pgr_revisions`/`risks`/`risk_assessments`/`control_measures`. Nenhum commit/push/PR.
