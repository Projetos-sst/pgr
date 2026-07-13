---
description: "Task list — Editor do PGR (abas) e visão consolidada"
---

# Tasks: Editor do PGR (abas) e visão consolidada

**Input**: Design documents from `.specs/019-pgr-consolidated-view/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Feature**: 019 · `feature/pgr-consolidated-view` · tabelas reais `pgr`/`pgr_ges`/`pgr_revisions`
(migration `0012`) · **ZERO MIGRATION**.

## Convenções

- Formato: `- [ ] [TaskID] [P?] [Story?] descrição — arquivo`. `[P]` = paralelizável (arquivos
  distintos, sem dependência pendente).
- Histórias: **US1** editor em abas + Informações básicas (P1) · **US2** vínculo GES (P1) ·
  **US3** visão consolidada (P1) · **US4** revisões (P2).
- **Guardrails absolutos** (valem para toda task): NÃO migration; NÃO tocar
  `src/shared/db/schema/**` nem `migrations/**`; NÃO GED/upload/storage/download/URL assinada/tabela
  de documentos; NÃO persistir cor/sumário/aceite/autor de revisão; NÃO status manual de medidas /
  enum/coluna de status; NÃO snapshot de `riskLevel`/`result`; NÃO PDF; NÃO alterar
  `control_measures`/`risk_methodology`; NÃO IA; NÃO aceitar `orgId`/`organizationId`/
  `organization_id` do client; NÃO SQLite. Update/Delete de revisão **não** existem (append-only).

---

## Fase 1 — Setup / higiene

- [x] T001 Confirmar branch `feature/pgr-consolidated-view` e `.specify/feature.json` →
      `.specs/019-pgr-consolidated-view` (`git branch --show-current`; `cat .specify/feature.json`).
      Critério: ambos batem.
- [x] T002 Confirmar zero schema/migration antes de começar
      (`git diff -- src/shared/db/schema src/shared/db/migrations` vazio; `.env` não aparece). Critério:
      diff vazio; nenhum secret impresso.
- [x] T003 Revisar contratos aprovados (`.specs/019-pgr-consolidated-view/contracts/*.md` +
      `data-model.md`) e conferir nomes reais contra `src/shared/db/schema/pgr.ts` (`pgr`, `pgr_ges`
      UNIQUE `(org_id,pgr_id,ges_id)`, `pgr_revisions` UNIQUE `(org_id,pgr_id,revision_number)`, sem
      autor). Critério: nomes/UNIQUE conferidos.
- [x] T004 Registrar no `tasks.md` que os artefatos do plan têm **Prettier cosmético pendente**
      (alinhamento de tabela) a limpar na Fase 11. Critério: nota presente.

---

## Fase 2 — Domain (`src/shared/domains/pgr/`) — Foundational

Bloqueia repos/actions/REST/UI/testes. Arquivos distintos → alguns `[P]`.

- [x] T005 [P] Criar `src/shared/domains/pgr/pgr-ges.ts`: `pgrGesInputSchema = z.object({ gesId:
requiredUuid("GES é obrigatório") })` + tipos `PgrGesInput`/`PgrGesValues` + projeção
      `PgrGesLinkItem` (`id`,`gesId`,`gesName`,`createdAt:Date`). Critério: compila; sem tenant no input.
- [x] T006 [P] Criar `src/shared/domains/pgr/pgr-revision.ts`: `pgrRevisionInputSchema = z.object({
revisionNumber: z.coerce.number().int().min(1), revisedAt: z.iso.date(...), notes: optionalString
})` + tipos + projeção `PgrRevisionListItem` (`revisedAt:string`, `createdAt:Date`). **Sem** campo
      autor. Critério: `revisionNumber` ≥1 exigido; `revisedAt` valida calendário.
- [x] T007 Criar `src/shared/domains/pgr/pgr-consolidated.ts`: tipos `ConsolidatedMeasure` /
      `ConsolidatedRisk` / `ConsolidatedGes` / `PgrConsolidated` (data-model). Reexporta/reusa
      `ControlLevel`/`MeasureState`/`RiskClassification`/`RiskAgentType`. Critério: tipos exportados.
- [x] T008 Implementar em `pgr-consolidated.ts` a função **pura** `sortConsolidatedRisks(risks):
ConsolidatedRisk[]` — riscos **com** avaliação primeiro por `riskLevel` desc (desempate estável),
      **sem** avaliação por último. Critério: pura, determinística.
- [x] T009 Em `pgr-consolidated.ts`, expor helper que deriva o `state` de cada medida via
      `deriveMeasureState(measure, today)` (reuso da 018) — `today` recebido como parâmetro
      (`America/Sao_Paulo`). **Sem** status manual. Critério: reusa 018; sem lógica de status nova.

---

## Fase 3 — Repositories (`src/shared/db/repositories/`) — Foundational

Depende do domínio. Arquivos distintos → `[P]` entre repos, sequencial dentro de cada arquivo.

- [x] T010 [P] [US2] Criar `repositories/pgr-ges.ts` (`"server-only"`): `assertGesInTenant`
      (`ReferenceNotFoundError("ges")`); `listPgrGes(orgId, pgrId)` (`pgr_ges` ⨝ `ges`, filtro
      `org_id`+`pgr_id`, ordena por `ges.name`); `addGesToPgr` (`auditedTenantWrite` + `assertGes` +
      INSERT; **sem** catch de 23505 → DUPLICATE); `removeGesFromPgr` (DELETE por `(org,pgr,ges)`
      RETURNING → boolean; **só o vínculo**). Critério: CRUD do vínculo compila; duplicidade lança 23505.
- [x] T011 [P] [US4] Criar `repositories/pgr-revisions.ts` (`"server-only"`):
      `listPgrRevisions(orgId, pgrId)` (filtro `org_id`+`pgr_id`, ordena `revision_number` desc);
      `createPgrRevision(orgId, pgrId, values)` (`auditedTenantWrite` + INSERT; UNIQUE → 23505 →
      DUPLICATE; **sem autor**). **Sem** update/delete. Critério: list/create compilam.
- [x] T012 [US3] Criar `repositories/pgr-consolidated.ts` (`"server-only"`, **read-only**)
      `getPgrConsolidated(orgId, pgrId)`: `withOrg`; (1) PGR+empresa+obra (`null` se ausente); (2) GES
      vinculados; (3) riscos `inArray(gesIds)`; (4) **avaliação vigente por risco em 1 query** —
      `DISTINCT ON (risk_id) ... ORDER BY risk_id, assessed_at desc, created_at desc`; (5) medidas
      `inArray(riskIds)`. Critério: monta o resultado; PGR ausente → `null`.
- [x] T013 [US3] Em `pgr-consolidated.ts`, garantir **bind seguro** no SQL do `DISTINCT ON`: usar
      Drizzle `inArray(...)` / `sql` parametrizado; **nunca** interpolar ids em string. Compor em
      memória (agrupar por GES/risco, `deriveMeasureState`, `sortConsolidatedRisks`). Critério: sem
      interpolação manual; **sem N+1** (nenhuma query por risco).

---

## Fase 4 — Server Actions (`src/shared/server/actions/pgr/`) — Foundational

Depende de repos. `editPath = "/pgr/[id]"`.

- [x] T014 [P] [US2] Criar `actions/pgr/pgr-ges.ts` (`"use server"`): `listPgrGesAction(pgrId)`
      (valida `getPgrById`→`NotFoundError`/404; sem audit), `addGesToPgrAction(pgrId, input)`
      (`getPgrById`→404; `pgrGesInputSchema.parse`; `addGesToPgr`; `{audit:true}`;
      `revalidatePath('/pgr/'+pgrId)`), `removeGesFromPgrAction(pgrId, gesId)` (`removeGesFromPgr`;
      `false`→`NotFoundError`; `{audit:true}`). Critério: `ActionResult`; sem Drizzle; erros corretos.
- [x] T015 [P] [US4] Criar `actions/pgr/pgr-revisions.ts`: `listPgrRevisionsAction(pgrId)`
      (`getPgrById`→404; sem audit) e `createPgrRevisionAction(pgrId, input)` (`getPgrById`→404;
      `pgrRevisionInputSchema.parse`; `createPgrRevision`; `{audit:true}`; `revalidatePath`). Critério:
      nº duplicado → DUPLICATE.
- [x] T016 [P] [US3] Criar `actions/pgr/pgr-consolidated.ts`: `getPgrConsolidatedAction(pgrId)`
      (`getPgrConsolidated`; `null`→`NotFoundError`/404; **sem** audit). Critério: `ActionResult<PgrConsolidated>`.

---

## Fase 5 — REST (`restHandler`) — Foundational

Depende de repos/actions. Arquivos distintos → `[P]`.

- [x] T017 [P] [US2] Criar `src/app/api/v1/pgr/[id]/ges/route.ts` (`runtime="nodejs"`,
      `dynamic="force-dynamic"`): `GET` (getPgrById→404 + `listPgrGes`) + `POST`
      (`pgrGesInputSchema.parse(await req.json())` + `addGesToPgr`, `status:201`). Critério: 200/201;
      409 duplicado; 422 FK GES.
- [x] T018 [P] [US2] Criar `src/app/api/v1/pgr/[id]/ges/[gesId]/route.ts`: `DELETE`
      (`removeGesFromPgr`; `false`→`NotFoundError`; `status:204`). Critério: 204; 404 cross-tenant.
- [x] T019 [P] [US4] Criar `src/app/api/v1/pgr/[id]/revisions/route.ts`: `GET` (list) + `POST`
      (create, `status:201`). **Sem** PUT/DELETE. Critério: 200/201; 409 nº duplicado; 422 validação.
- [x] T020 [P] [US3] Criar `src/app/api/v1/pgr/[id]/consolidated/route.ts`: `GET`
      (`getPgrConsolidated`; `null`→`NotFoundError`). Critério: 200; 404 PGR cross-tenant.
- [x] T021 Conferir mapeamento herdado (`toActionError`/`HTTP_BY_CODE`): 23505→DUPLICATE/409,
      `ReferenceNotFoundError("ges")`→FK_NOT_FOUND/422, `NotFoundError`→NOT_FOUND/404,
      ZodError→VALIDATION/422, client→FORBIDDEN/403. Critério: nenhum handler reimplementa regra; tenant
      nunca do body/query.

---

## Fase 6 — UI (`src/app/(protected)/pgr/[id]/`)

Depende das Actions. Componentes em arquivos distintos → vários `[P]`.

- [x] T022 [US1] Reescrever `src/app/(protected)/pgr/[id]/page.tsx` como **shell** do editor:
      `requireOfficeStaffPage()` + `getPgrAction` (404) + renderiza `PgrEditorTabs` com o PGR carregado.
      Critério: página serve o editor.
- [x] T023 [P] [US1] `_components/pgr-editor-tabs.tsx` (client): navegação de abas
      (Informações básicas · GES · Revisões · Consolidada) + abas **desabilitadas** Cor/Sumário e
      Documentos GED (aviso "Fase 05"). Critério: 4 abas funcionais + 2 placeholders.
- [x] T024 [P] [US1] `_components/pgr-basic-info-tab.tsx`: exibe os campos reais de `pgr` e
      **reaproveita/linka** a edição existente (`/pgr/[id]/edit` + `pgr-form`) — sem duplicar CRUD.
      Critério: dados básicos exibidos/editáveis.
- [x] T025 [P] [US1] `_components/pgr-disabled-placeholder-tab.tsx`: painel desabilitado reutilizável
      ("Disponível na Fase 05"). Critério: usado por Cor/Sumário e GED.
- [x] T026 [US2] `_components/pgr-ges-tab.tsx` (client): lista GES vinculados (`listPgrGesAction`),
      seletor para **adicionar** (`addGesToPgrAction`), **remover** com confirmação
      (`removeGesFromPgrAction`); trata **409** ("GES já vinculado") e mensagens de erro. Critério: add/
      remove funcionam; duplicidade amigável.
- [x] T027 [US4] `_components/pgr-revisions-tab.tsx` (client): lista revisões
      (`listPgrRevisionsAction`) + **formulário de nova revisão** (nº/data/notas) via
      `createPgrRevisionAction`; trata **409** (nº repetido). Critério: cria e lista; sem update/delete.
- [x] T028 [US3] `_components/pgr-consolidated-tab.tsx`: consome `getPgrConsolidatedAction`; exibe
      PGR/empresa/obra, GES agrupados, riscos **ordenados por nível** com avaliação vigente + medidas
      com **estado derivado**; **fallbacks** (PGR sem GES / GES sem riscos / "Sem avaliação vigente" /
      "Sem medidas de controle"); **sem** status manual. Critério: consolidada + 4 fallbacks visíveis.

---

## Fase 7 — Docs / Postman

Arquivos distintos → `[P]`.

- [x] T029 [P] Atualizar `docs/api/api-design.md`: recurso **PGR Editor** (GES-link, revisões,
      consolidada), **verbos reduzidos justificados** (GES sem PUT; revisões só GET/POST; consolidada
      GET), códigos 409/422/404/403, nas tabelas "Recursos"/"Sumário" + seção + rotas UI. Critério:
      documentado.
- [x] T030 [P] Atualizar `docs/api/sst-manager.postman_collection.json`: pasta **"PGR Editor"**
      (list/add/remove GES, list/create revisão, get consolidated) + variáveis **`pgrId`**, **`gesId`**,
      **`pgrRevisionId`** (se útil no response); reusar `baseUrl`/`devTenant`/`devRole`. Critério: pasta
  - variáveis presentes.
- [x] T031 [P] Adicionar no Postman exemplos de erro: **403** (client), **404** (PGR cross-tenant),
      **409** (GES duplicado / revisão nº repetido), **422** (validation / FK GES). Critério: parser
      valida o JSON da coleção.

---

## Fase 8 — Unit tests (`src/__tests__/unit/domains/pgr/`)

Depende do domínio. Arquivos distintos → `[P]`.

- [x] T032 [P] Criar `pgr-consolidated.test.ts`: `sortConsolidatedRisks` (com avaliação por
      `riskLevel` desc; **sem avaliação por último**); estado derivado das medidas (reuso 018);
      fallbacks (PGR sem GES → `ges:[]`; GES sem riscos → `risks:[]`; risco sem avaliação → `riskLevel
null`; risco sem medidas → `measures:[]`); **ausência de status persistido**. Critério: casos
      passam.
- [x] T033 [P] Criar `pgr-revision.test.ts` (e cobertura de `pgr-ges` se útil): `revisionNumber`
      obrigatório e **≥1**; `revisedAt` obrigatório/válido; `notes` opcional; `gesId` UUID obrigatório.
      Critério: validação Zod coberta.

---

## Fase 9 — Integration tests (`src/__tests__/integration/pgr-editor/`)

Contra **Postgres efêmero** (`INTEGRATION_*`), nunca SQLite. Suites em arquivos distintos → `[P]`.

- [x] T034 [P] [US2] `pgr-ges.test.ts` (Actions): list/add/remove vínculo; **duplicate → DUPLICATE**;
      GES cross-tenant → **FK_NOT_FOUND**; PGR cross-tenant → **NOT_FOUND**; role `client` →
      **FORBIDDEN**. Critério: verde no efêmero.
- [x] T035 [P] [US4] `pgr-revisions.test.ts`: list/create; **duplicate revision → DUPLICATE**;
      PGR cross-tenant → **NOT_FOUND**; `client` → **FORBIDDEN**. Critério: verde.
- [x] T036 [P] [US3] `pgr-consolidated.test.ts`: agrega GES→riscos→avaliação vigente→medidas;
      **ordena por `risk_level` desc**; **risco sem avaliação por último**; PGR cross-tenant →
      **NOT_FOUND**; **não vaza** dados de outro tenant. Critério: ordenação e isolamento provados.
- [x] T037 [P] `pgr-editor-isolation.test.ts`: `runIsolationSuite` para `pgr_ges` e `pgr_revisions`
      (lista não vaza; RLS backstop; insert cross-tenant bloqueado). Critério: isolamento provado.
- [x] T038 [P] `rest-pgr-editor.test.ts`: GET/POST/DELETE `ges`, GET/POST `revisions`, GET
      `consolidated`; 403/404/409/422. Critério: status corretos **ou** falha 500 documentada (T039).
- [x] T039 Se `rest-pgr-editor.test.ts` falhar com 500 (limitação pré-existente do harness, 014/016/
      018), **documentar** e provar por comparação (rodar um `rest-*` mergeado no mesmo efêmero).
      Critério: causa registrada; validação real fica no cURL (T040).

---

## Fase 10 — Validação manual (quickstart)

- [x] T040 cURL REST real contra dev server + Postgres efêmero (headers dev-bypass): list GES 200,
      add 201, **duplicate 409**, FK GES 422, remove 204; revisions list 200 / create 201 / dup 409;
      consolidated 200; client 403; PGR cross-tenant 404. Critério: 100% dos status; registrar tenant
      (`org_a`).
- [x] T041 Criar e desfazer dados de teste via cURL (vincular/remover GES; criar revisão); validar
      **409** e **404**. Critério: ambiente limpo ao final; sem secrets; nunca Supabase compartilhado.
- [ ] T042 Playwright MCP (se houver credencial Clerk): abrir `/pgr/[id]`, navegar abas, vincular/
      remover GES, criar revisão, abrir consolidada (ordenação/fallbacks/estado derivado). Critério:
      fluxo validado **ou** marcado **bloqueado** (sem credencial) — não falha.
- [x] T043 Remover o container efêmero ao final (`docker rm -f ...`). Critério: ambiente limpo.

---

## Fase 11 — Quality gates finais (antes de commit/push/PR)

- [x] T044 Prettier **dirigido** nos artefatos `.specs/019-pgr-consolidated-view/**/*.md` +
      arquivos de código tocados pela feature → todos clean. Critério: `prettier --check` verde nos
      arquivos da feature.
- [x] T045 `npm run lint` + `npm run typecheck` verdes. Critério: 0 erros.
- [x] T046 `npm run test` (unit) + `npm run test:integration` (efêmero) verdes; anexar resultado do
      REST (verde ou 500-harness documentado + cURL). Critério: unit/integração ok.
- [x] T047 `npm run build` verde. Critério: build ok.
- [x] T048 `npm run format:check` final; ao falhar, **separar** (a) falhas reais da feature
      (corrigir), (b) **ruído CRLF pré-existente** (ignorar — CI-LF não acusa), (c) arquivos fora do
      escopo. Rodar `git status --short`, `git diff --name-status`, `git diff --check`,
      `git diff -- src/shared/db/schema src/shared/db/migrations` (**vazio**). Critério: só arquivos da
      feature mudaram; zero schema/migration; sem whitespace error; `.env` ausente.

---

## Dependências

- **Fase 1** → tudo.
- **Fase 2 (domínio)** → 3,4,6,8.
- **Fase 3 (repos)** → 4,5,9.
- **Fase 4 (actions)** → 6, parte da 9.
- **Fase 5 (REST)** → 9 (rest) + 10 (cURL).
- **Fases 7/8/9** independem entre si após suas deps de camada.
- **Fase 11** por último.

## Grafo de entrega (MVP incremental)

1. **US1 (P1)** = shell de abas + Informações básicas (T022–T025) — porta de entrada.
2. **US2 (P1)** = vínculo GES (T005/T010/T014/T017-018/T026 + testes) — alimenta a consolidada.
3. **US3 (P1)** = consolidada (T007-009/T012-013/T016/T020/T028 + testes) — entregável-título.
4. **US4 (P2)** = revisões (T006/T011/T015/T019/T027 + testes).

## Paralelização (exemplos)

- Após T009: T010 ‖ T011 (repos distintos). Após T013: T014 ‖ T015 ‖ T016.
- REST: T017 ‖ T018 ‖ T019 ‖ T020. Componentes: T023 ‖ T024 ‖ T025.
- Docs: T029 ‖ T030 ‖ T031. Unit: T032 ‖ T033. Integração: T034 ‖ T035 ‖ T036 ‖ T037 ‖ T038.

## Confirmações de escopo (materializadas)

zero migration (T002/T048) · sem schema · tabelas reais `pgr`/`pgr_ges`/`pgr_revisions` · **GED
fora** (só placeholder T023/T025) · **cor/sumário fora** (placeholder) · **aceite persistido fora** ·
**autor de revisão fora** (T006/T011) · **sem status manual** (T009/T028/T032) · estados derivados
(T009) · REST/docs/Postman (Fases 5/7) · Postman `pgrId`/`gesId`/`pgrRevisionId` (T030) · **bind
seguro** na consolidada (T013) · testes (Fases 8/9) · cURL (T040/T041) · Playwright previsto (T042).
