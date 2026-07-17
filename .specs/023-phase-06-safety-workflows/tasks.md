# Tasks — Fase 06 (023): Ordens de Serviço, Incidentes/Acidentes, Planos de Ação 5W2H e Auditorias

**Branch**: `feature/phase-06-safety-workflows` · **Base**: `origin/develop` @ `f2bbf59` · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Formato: `- [ ] T### [P?] [USx] ação em \`caminho\`. Depende de: …. Conclusão: critério verificável.[P]` = paralelizável (arquivos distintos, sem dependência pendente, sem disputa de banco, sem registry exaustivo compartilhado).

Convenção de reuso (não reimplementar): `withOrg`, `officeAction`, `restHandler`, `auditedTenantWrite`, `ActionResult<T>`, `resolvePageParams`, `createSignatureRequestCore`, infra Anthropic (`isAiSuggestionAvailable`/`recordAiUsage`/`AiUnavailableError`). Testes de integração em **Postgres efêmero** (`INTEGRATION_DATABASE_URL`/`INTEGRATION_APP_RUNTIME_URL`, `--runInBand`, **nunca** SQLite).

---

## Bloco A — Reconciliação de migrations + schema/RLS (US1) — BLOQUEANTE

> Nenhuma task de schema executa antes da reconciliação (T001–T006). Nenhum tipo pendente na migration (T007–T010).

- [X] T001 [US1] Auditar o histórico de migrations em `src/shared/db/migrations/` (arquivos `.sql`, `meta/_journal.json`, `meta/*_snapshot.json`) e produzir a matriz de inconsistência (2 órfãos `0018_org_billing.sql`/`0018_user_is_master.sql`; tag `0018_schedule_events` sem `.sql`; `0023_schedule_events.sql`; `schedule_events` duplicado idx 18/23). Depende de: nenhuma. Conclusão: matriz escrita e confirmada contra `research.md §1`, sem alterar nada.
- [X] T002 [US1] Conferir a sequência realmente aplicada via `SELECT * FROM drizzle.__drizzle_migrations ORDER BY id` no ambiente **autorizado** (owner, com backup/validação, sem imprimir segredos). Depende de: T001. Conclusão: lista de hashes aplicados capturada e anexada à matriz.
- [X] T003 [US1] Comparar banco (`__drizzle_migrations`) × journal × arquivos `.sql` × snapshots e classificar cada divergência (aplicado-sem-arquivo / arquivo-sem-journal / duplicado). Depende de: T002. Conclusão: cada item da matriz recebe um veredito de origem.
- [X] T004 [US1] Definir a **correção mínima** compatível com banco novo **e** existente (ex.: materializar o `.sql` faltante da tag `0018_schedule_events` a partir do snapshot; realocar/registrar os órfãos billing/is_master com o hash já aplicado). Depende de: T003. Conclusão: plano de reconciliação escrito, sem apagar/renumerar às cegas.
- [X] T005 [US1] Aplicar a reconciliação em `src/shared/db/migrations/` **somente com evidência** de T002/T004 (journal + arquivos). Depende de: T004. Conclusão: journal e arquivos coerentes; banco existente não re-aplica nada.
- [X] T006 [US1] Validar `db:migrate` do **zero** em Postgres efêmero limpo e confirmar que o glob de `src/__tests__/integration/_helpers/db.ts` continua verde. Depende de: T005. Conclusão: migração limpa sem erro (SC-014).
- [X] T007 [P] [US1] Fixar o conjunto **fechado** de `accident_category` em `data-model.md`/`research.md` (sem lookup externo). Depende de: T001. Conclusão: valores definidos e referenciados no schema de `accidents`.
- [X] T008 [P] [US1] Definir `priority` de `action_plans` como `smallint` **ou** pgEnum (escolha única) em `data-model.md`. Depende de: T001. Conclusão: tipo definitivo registrado, sem ambiguidade.
- [X] T009 [P] [US1] Decidir a emissão da UNIQUE parcial de `risk_audits` — `uniqueIndex().where()` do Drizzle **vs.** `CREATE UNIQUE INDEX … WHERE status <> 'completed'` custom — em `data-model.md`. Depende de: T001. Conclusão: forma de emissão escolhida.
- [X] T010 [P] [US1] Documentar o acoplamento **unidirecional** `action_plans → incident-lifecycle` (planos avançam o incidente, nunca o inverso) em `research.md §5`. Depende de: T001. Conclusão: nota de acoplamento fechada.
- [X] T011 [P] [US1] Criar `src/shared/db/schema/service-orders.ts` (`service_orders` + `service_order_items` + enum `service_order_status`; `UNIQUE(org_id, number)`; índices; RLS `USING`+`WITH CHECK`; `org_id` próprio nos itens). Depende de: T006, T008. Conclusão: schema compila (`typecheck`) e segue o template de `companies.ts`.
- [X] T012 [P] [US1] Criar `src/shared/db/schema/accidents.ts` (`accidents` + enums `accident_type/category/severity/status`; FKs `company_id`/`employee_id` com ON DELETE; índices; RLS). Depende de: T006, T007. Conclusão: schema compila com os campos CAT textuais opcionais.
- [X] T013 [P] [US1] Criar `src/shared/db/schema/action-plans.ts` (`action_plans`; `origin_type` **TEXT**; `how_much` numeric; enum `action_plan_status`; índice `(org_id, origin_type, origin_id)`; RLS). Depende de: T006, T008, T010. Conclusão: schema compila; `origin_id` sem FK física.
- [X] T014 [P] [US1] Criar `src/shared/db/schema/risk-audits.ts` (`risk_audits`; `origin_type` TEXT; enum `risk_audit_status`; UNIQUE parcial conforme T009; RLS). Depende de: T006, T009. Conclusão: schema compila com a UNIQUE parcial.
- [X] T015 [US1] Re-exportar as novas tabelas no barrel `src/shared/db/schema/index.ts`. Depende de: T011–T014. Conclusão: `import` das 5 tabelas resolve; `drizzle.config` enxerga o schema.
- [X] T016 [US1] Gerar a migration `0024_phase_06_safety_workflows` via `drizzle-kit` e completar o **SQL custom** (GRANTs `app_runtime`, triggers `set_updated_at`, UNIQUE parcial se custom). Depende de: T015, T006. Conclusão: `db:generate` emite **apenas** o delta da Fase 06 (não re-emite billing/is*master); arquivo `0024*\*.sql` + snapshot criados.
- [X] T017 [P] [US1] Testes de integração estruturais em `src/__tests__/integration/safety/schema.test.ts`: tabelas/enums/FKs/UNIQUEs/UNIQUE parcial/índices/`WITH CHECK`/`app_runtime` + isolamento tenant A/B (SELECT/INSERT sem `withOrg` → 0 linhas/bloqueado). Depende de: T016. Conclusão: RLS real comprovada (SC-013).
- [X] T018 [US1] **Gate Bloco A**: `db:migrate` limpo pós-reconciliação + `test:integration` (subset schema) verde + `typecheck`. Depende de: T017. Conclusão: base pronta; commit verde `feat(db): add phase-06 safety schema + reconcile migration journal (0024)`.

---

## Bloco B — CRUD de Ordem de Serviço + itens (US2)

- [X] T019 [P] [US2] `src/shared/domains/safety/service-order.ts`: schemas Zod `.strict()` (OS + item, `description` ≤500), status, filtros/paginação, regras de edição/exclusão, marcação de snapshot. Depende de: T018. Conclusão: unit da validação passa; `days_open` exposto como derivado.
- [X] T020 [P] [US2] `src/shared/domains/safety/service-order-number.ts`: função pura de derivação/validação de número e `days_open` (fuso America/Sao_Paulo). Depende de: T018. Conclusão: unit cobre casos de borda.
- [X] T021 [US2] `src/shared/db/repositories/service-orders.ts`: `list/getById/create/update/delete` + `buildSuggestedItems` (`employee.ges_id → risks → epi_risk → epi_catalog`); numeração `SELECT … FOR UPDATE` na linha de `orgs` + `max(number)+1` + UNIQUE backstop (sem lock global); OS+itens na **mesma transação** (rollback conjunto); employee cross-tenant → `FkNotFound`, OS cross-tenant → `NotFound`. Depende de: T019, T020. Conclusão: repo compila; itens imutáveis após assinatura.
- [X] T022 [US2] `src/shared/server/actions/safety/service-orders.ts`: Actions via `officeAction` (audit sem PII) + `revalidatePath`; **sem** Drizzle direto. Depende de: T021. Conclusão: `ActionResult<T>` para list/get/create/update/delete.
- [X] T023 [P] [US2] `src/app/api/v1/service-orders/route.ts` (`GET` list + `POST` create, 201). Depende de: T021. Conclusão: cURL retorna 200/201; usa o mesmo repo/zod.
- [X] T024 [P] [US2] `src/app/api/v1/service-orders/[id]/route.ts` (`GET`/`PUT`/`DELETE`, 204). Depende de: T021. Conclusão: 404 cross-tenant; 204 no delete permitido.
- [X] T025 [P] [US2] `src/app/api/v1/service-orders/[id]/status/route.ts` (`PUT` transição de estado). Depende de: T021. Conclusão: terminal não retrocede (erro de estado).
- [X] T026 [US2] UI `src/app/(protected)/service-orders/**` (list/filtros/paginação/`new`/`[id]`/`[id]/edit`/checklist + empty/loading/error) seguindo o design system 019; registrar rota no mega-menu `src/app/(protected)/_components/nav-menu.tsx`. Depende de: T022. Conclusão: fluxo navegável; rota aparece no menu.
- [X] T027 [P] [US2] Unit `src/__tests__/unit/domains/safety/service-order.test.ts` (numeração, `days_open`, `description` ≤500, regras de exclusão). Depende de: T019, T020. Conclusão: verde.
- [X] T028 [US2] Integração `src/__tests__/integration/safety/service-orders.test.ts`: 2 OS concorrentes no mesmo tenant → números consecutivos (SC-001); tenants independentes (SC-002); OS+itens atômico + rollback (SC-003); snapshot; cross-tenant (404/422); filtros; exclusão permitida/bloqueada. Depende de: T022. Conclusão: verde; **Gate Bloco B**.

---

## Bloco C — Workflow e assinatura da OS (US3)

> Depende do Bloco B + infra genérica de assinatura. As 3 alterações de registry **não** são paralelas.

- [X] T029 [US3] `src/shared/domains/signatures/targets/service-order.ts`: payload público `.strict()` (6 campos: `documentTitle`, `serviceOrderNumber`, `companyName`, `employeeName`, `issuedAt`, `items`); `items` ≤100, `description` ≤500; **sem** CPF/`org_id`/IDs internos/dados médicos/token. Depende de: T018. Conclusão: unit de shape rejeita campo extra e excedente (SC-006).
- [X] T030 [US3] Registrar `service_order` em `src/shared/domains/signatures/contract.ts` (`SIGNATURE_TARGET_TYPES` + `signatureTargetRegistry` com o `payloadSchema` de T029) — mudança **atômica**. Depende de: T029. Conclusão: `typecheck` verde (Record exaustivo completo).
- [X] T031 [US3] Criar `src/shared/ui/signature/ServiceOrderSignatureForm.tsx` e registrar em `src/shared/ui/signature/form-registry.tsx` — mudança **atômica** com T030. Depende de: T030. Conclusão: `signatureFormRegistry` exaustivo compila.
- [X] T032 [P] [US3] `src/shared/domains/safety/service-order-signature.ts`: view/estado derivado `none|pending|signed|expired|cancelled` (espelha `derivePgrSignatureState`). Depende de: T018. Conclusão: unit dos estados passa.
- [X] T033 [US3] `src/shared/db/repositories/service-order-signature.ts`: `getServiceOrderSignatureSource` (dados p/ payload no servidor) + `getServiceOrderSignatureState` (derivado de `signature_requests`/`captures`). Depende de: T032, T021. Conclusão: fonte mínima sem PII; estado derivado sem token/URL.
- [X] T034 [US3] `src/shared/server/safety/service-order-signature-core.ts`: monta o payload **no servidor**, valida OS no tenant (→404 antes de cota/escrita), delega a `createSignatureRequestCore` (cota compartilhada). Depende de: T033, T030. Conclusão: retorna `{signature, requestId, publicUrl, qrCodeDataUrl}` (publicUrl só aqui).
- [X] T035 [US3] `src/shared/server/actions/safety/service-order-signature.ts`: `create` (link + QR só na criação) e `get` (estado sem token/URL). Depende de: T034. Conclusão: `ActionResult<T>`; token nunca logado/persistido cru.
- [X] T036 [US3] `src/app/api/v1/service-orders/[id]/signature/route.ts`: `GET` (estado derivado) + `POST` (cria, protegido, 201). Depende de: T035. Conclusão: 201 na criação; **nenhum** REST público criado.
- [X] T037 [US3] UI: painel de assinatura no detalhe da OS (`src/app/(protected)/service-orders/[id]/_components/signature-panel.tsx`) com aviso de **cópia única**. Depende de: T035, T026. Conclusão: link visível só na criação; QR renderiza.
- [X] T038 [US3] UI pública: form registrado no renderer genérico, servido por `/signature-requests/[token]` (página existente, **não** `/assinar`). Depende de: T031. Conclusão: assinatura sem Clerk funciona; `no-store`.
- [X] T039 [P] [US3] Unit `src/__tests__/unit/domains/safety/service-order-signature.test.ts` (payload strict/shape, limite 100/500, estado derivado). Depende de: T029, T032. Conclusão: verde.
- [X] T040 [US3] Integração/E2E `src/__tests__/integration/safety/service-order-signature.test.ts` + Playwright público: token válido/inválido/expirado/usado/replay (SC-005), payload congelado sem PII, cota compartilhada, QR, no-store, sem Clerk (SC-004). Depende de: T036, T038. Conclusão: verde; **Gate Bloco C**.

---

## Bloco D — CRUD de Incidentes/Acidentes (US4)

- [X] T041 [P] [US4] `src/shared/domains/safety/accident.ts`: zod input, enums fechados, campos CAT **textuais opcionais** (CAT interno, sem S-2210/`esocial_events`). Depende de: T018. Conclusão: unit aceita campos opcionais vazios.
- [X] T042 [P] [US4] `src/shared/domains/safety/incident-lifecycle.ts`: **única** fonte das transições `registered→awaiting_planning→awaiting_completion→completed` (+`cancelled`), regras de conclusão (justificativa, bloqueio com plano ativo), terminal não volta. Depende de: T018. Conclusão: unit cobre transições válidas/inválidas.
- [X] T043 [US4] `src/shared/db/repositories/accidents.ts`: `list/get/create/update/delete` + filtros/paginação; valida `company_id`/`employee_id` no tenant; sem gravar `esocial_events`. Depende de: T041. Conclusão: repo compila; cross-tenant → `NotFound`.
- [X] T044 [US4] `src/shared/server/actions/safety/accidents.ts`: Actions via `officeAction` (`requireOfficeStaff`; `client`→403); audit **sem** dado de saúde. Depende de: T043. Conclusão: `ActionResult<T>`; log sem PII/saúde.
- [X] T045 [P] [US4] `src/app/api/v1/incidents/route.ts` (`GET`/`POST`). Depende de: T043. Conclusão: 200/201; `client`→403.
- [X] T046 [P] [US4] `src/app/api/v1/incidents/[id]/route.ts` (`GET`/`PUT`/`DELETE`). Depende de: T043. Conclusão: 404 cross-tenant; corpo de erro sem dado de saúde.
- [X] T047 [P] [US4] `src/app/api/v1/incidents/[id]/status/route.ts` (`PUT`). Depende de: T043, T042. Conclusão: transição via `incident-lifecycle`.
- [X] T048 [US4] UI `src/app/(protected)/incidents/**` com abas **Dados / Causas e investigação / Fotos** (Fotos = placeholder, sem upload/storage/base64); office staff; registrar no `nav-menu.tsx`. Depende de: T044. Conclusão: abas navegáveis; placeholder exibido.
- [X] T049 [US4] Integração `src/__tests__/integration/safety/incidents.test.ts`: CRUD, `client`→403 (SC-008), cross-tenant→404 (SC-007), campos opcionais, ausência de dado de saúde em log/audit, placeholder de fotos. Depende de: T044. Conclusão: verde.
- [X] T050 [P] [US4] Unit `src/__tests__/unit/domains/safety/incident-lifecycle.test.ts`. Depende de: T042. Conclusão: verde; **Gate Bloco D**.

---

## Bloco E — Planos 5W2H + ciclo de vida do incidente (US6 + US5)

- [X] T051 [P] [US6] `src/shared/domains/safety/action-plan.ts`: zod 5W2H (`what/why/who/where/when/how/how_much`), `priority`, status, `overdue` derivado (fuso America/Sao_Paulo). Depende de: T018. Conclusão: unit de 5W2H + overdue.
- [X] T052 [P] [US6] `src/shared/domains/safety/action-plan-origin.ts`: allowlist `{risk, incident}` + contrato de resolução de origem. Depende de: T018. Conclusão: tipos não suportados rejeitados na validação.
- [X] T053 [US6] `src/shared/db/repositories/action-plans.ts`: `list/get/create/update/delete-cancel` + transições; `resolveOriginRef` (existe + mesmo tenant → senão `FkNotFound`); origem removida → plano persiste (histórico); `completed_at`/`cancelled_at`; exclusão física só `planned` sem dependentes. Depende de: T051, T052, T043. Conclusão: repo compila; origem cross-tenant → 422.
- [X] T054 [US5] Ampliar `src/shared/db/repositories/accidents.ts` com `advanceIncidentOnFirstPlan(tx, …)` + `countActivePlansForIncident`, aplicando `incident-lifecycle` na **mesma transação** de `action_plans` (camada única). Depende de: T053, T042. Conclusão: primeiro plano ativo move `awaiting_planning→awaiting_completion`; regra não duplicada.
- [X] T055 [US6] `src/shared/server/actions/safety/action-plans.ts` (create/update/status/delete-cancel). Depende de: T053. Conclusão: `ActionResult<T>`; audit sem PII.
- [X] T056 [US5] `setAccidentStatusAction` em `src/shared/server/actions/safety/accidents.ts` usando `incident-lifecycle` (conclusão exige justificativa; bloqueada com plano ativo). Depende de: T054, T044. Conclusão: conclusão bloqueada retorna erro de estado.
- [X] T057 [P] [US6] REST `src/app/api/v1/action-plans/route.ts` + `[id]/route.ts` + `[id]/status/route.ts`. Depende de: T053. Conclusão: 201/204/200; 422 origem inválida.
- [X] T058 [US6] UI `src/app/(protected)/action-plans/**` (central multiorigem, filtros, detalhe, form 5W2H) + `nav-menu.tsx`. Depende de: T055. Conclusão: navegável; "Origem removida" exibido quando aplicável.
- [X] T059 [US5] UI `src/app/(protected)/incidents/management/**` (filtros Todos/Aguardando planejamento/Aguardando conclusão/Concluídos, ocultar concluídos, iniciar plano, marcar concluído, contagem de planos). Depende de: T056, T048. Conclusão: tela central operacional.
- [X] T060 [P] [US6] Unit `src/__tests__/unit/domains/safety/action-plan.test.ts` (5W2H, overdue, allowlist de origem). Depende de: T051, T052. Conclusão: verde.
- [X] T061 [US6] Integração `src/__tests__/integration/safety/action-plans.test.ts`: origem válida/inválida/cross-tenant→422 (SC-010), status, overdue, cancelamento, origem removida. Depende de: T055. Conclusão: verde.
- [X] T062 [US5] Integração `src/__tests__/integration/safety/incident-lifecycle.test.ts`: primeiro plano move o incidente; conclusão bloqueada com plano ativo (SC-009); plano cancelado resolve; justificativa obrigatória; terminal não volta. Depende de: T056. Conclusão: verde; **Gate Bloco E**.

---

## Bloco F — Auditorias/Kanban + IA (US7)

- [x] T063 [P] [US7] `src/shared/domains/safety/risk-audit.ts`: estados `awaiting_analysis→planning_actions→completed`, transições explícitas, justificativa obrigatória; origem `risk|incident`. Depende de: T018. Conclusão: unit de transições.
- [x] T064 [P] [US7] `src/shared/domains/safety/action-plan-suggestion.ts`: input **sanitizado** (allowlist não-PII de `research.md §7`) + output 5W2H (Zod). Depende de: T018. Conclusão: unit rejeita nome/CPF/hospital/testemunhas/fotos no input.
- [x] T065 [US7] `src/shared/db/repositories/risk-audits.ts`: `list/get/create/transition`; UNIQUE parcial (uma ativa por origem) → `DUPLICATE`; justificativa. Depende de: T063. Conclusão: 2ª ativa por origem rejeitada (SC-011).
- [x] T066 [US7] `src/shared/server/safety/action-plan-suggestion-core.ts`: valida origem no tenant → gate de cota (`isAiSuggestionAvailable`, free=20/pro ∞) → monta input não-PII → Anthropic (tool use, 5W2H validado) → `recordAiUsage(orgId, "action_plan_suggestion")`; falha → `AiUnavailableError`; timeout tratado. Depende de: T064, T053. Conclusão: `kind` gravado sem migration; degradação graciosa.
- [x] T067 [US7] `src/shared/server/actions/safety/risk-audits.ts` (list/get/create/status + `suggestActionPlan`). Depende de: T065, T066. Conclusão: `ActionResult<T>`; CRUD independe da IA.
- [x] T068 [P] [US7] REST `src/app/api/v1/risk-audits/route.ts` + `[id]/route.ts` + `[id]/status/route.ts` + `[id]/suggest-action-plan/route.ts`. Depende de: T065, T066. Conclusão: 402 `QUOTA_EXCEEDED` / 502 `AI_UNAVAILABLE` mapeados.
- [x] T069 [US7] UI `src/app/(protected)/risk-audits/**` kanban (3 colunas; transição só por **Action explícita**, sem drag-and-drop persistente; botão "Sugerir 5W2H com IA") + `nav-menu.tsx`. Depende de: T067. Conclusão: mover card exige confirmação/Action.
- [x] T070 [P] [US7] Unit `src/__tests__/unit/domains/safety/{risk-audit,action-plan-suggestion}.test.ts` (uma-ativa regra; allowlist bloqueia PII; output 5W2H). Depende de: T063, T064. Conclusão: verde.
- [x] T071 [US7] Integração `src/__tests__/integration/safety/risk-audits.test.ts`: uma ativa por origem→409 (SC-011), transições+justificativa, vínculo a planos, **IA mockada**, cota free/pro, degradação graciosa (IA off → CRUD 100% ok, SC-012). Depende de: T067. Conclusão: verde; **Gate Bloco F**.

---

## Bloco G — Docs/Postman + manuais + gates finais

- [x] T072 [P] Registrar em `docs/api/api-design.md` os recursos `service-orders` (+ assinatura protegida), `incidents`, `action-plans`, `risk-audits` e `suggest-action-plan`; página pública `/signature-requests/[token]` documentada como **não-REST**. Depende de: T036, T045, T057, T068. Conclusão: tabelas Recursos/Sumário atualizadas.
- [x] T073 [P] Adicionar as requests ao `docs/api/sst-manager.postman_collection.json` (uma pasta por recurso, exemplos válidos + erros principais; reusar variáveis `baseUrl`/`devTenant`/`devRole`/ids). Depende de: T036, T045, T057, T068. Conclusão: JSON válido; 1 arquivo.
- [x] T074 cURL manual (roteiro em `quickstart.md`): CRUDs, transições, concorrência, assinatura, cross-tenant, 403/404/409/422, IA, cota. Depende de: T072, T073. Conclusão: respostas conferem com os contratos.
- [ ] T075 [P] Playwright protegido `src/__tests__/e2e/safety-protected.spec.ts`: OS, assinatura (painel), incidentes, planos, kanban (quando Clerk disponível). Depende de: T037, T048, T058, T069. Conclusão: verde no ambiente com Clerk.
- [x] T076 [P] Playwright público `src/__tests__/e2e/service-order-signature-public.spec.ts`: assinatura da OS sem Clerk; token usado/expirado. Depende de: T038. Conclusão: verde.
- [ ] T077 **Gate final único**: `format:check` + `lint` + `typecheck` + `unit` + `integration --runInBand` + `build` + validar Postman JSON + `git diff --check` + diff de schema/migrations = apenas `0024` + reconciliação esperada. Depende de: T028, T040, T049, T061, T062, T071, T072, T073, T075, T076. Conclusão: tudo verde; PR pronto para review.

---

## Dependências (visão geral)

```txt
A (T001–T018)  → bloqueia TODOS os módulos persistidos
B (T019–T028)  → depende de A
C (T029–T040)  → depende de A + B + infra genérica de assinatura
D (T041–T050)  → depende de A
E (T051–T062)  → depende de A + D (+ risks existentes)
F (T063–T071)  → depende de A + E
G (T072–T077)  → depende de B–F
```

- A **assinatura pública** (T038/T076) não depende da UI protegida (T037) para funcionar.
- A **IA** (T066) não bloqueia o CRUD de planos (Bloco E é independente da IA).
- As 3 alterações de **registry** de assinatura (T029→T030→T031) são **sequenciais** (Record exaustivo compartilhado; typecheck nunca vermelho entre elas).

## Caminho crítico

`T001→T002→T003→T004→T005→T006→T016→T018` (reconciliação + migration) `→ T021→T022→T028` (OS) `→ T033→T034→T035→T036→T040` (assinatura) `→ T053→T054→T056→T062` (planos+ciclo) `→ T065→T066→T067→T071` (auditorias+IA) `→ T077` (gate final).

## Exemplos de paralelização

- Bloco A: `T007 T008 T009 T010` (decisões) e depois `T011 T012 T013 T014` (schemas, arquivos distintos) em paralelo.
- Bloco B: `T023 T024 T025` (REST distintos) + `T027` (unit) em paralelo após `T021`.
- Bloco D: `T045 T046 T047` (REST) + `T050` (unit) em paralelo.
- Bloco G: `T072 T073` (docs/Postman) + `T075 T076` (Playwright) em paralelo.

## Estratégia de entrega (MVP incremental)

- **MVP**: Blocos A + B (fundação + CRUD de OS) = registro operacional utilizável.
- **+Conformidade**: Bloco C (assinatura da OS).
- **+Incidentes**: Blocos D + E (registro, ciclo de vida, planos).
- **+Gestão/IA**: Bloco F (kanban + sugestão).
- **Fechamento**: Bloco G (docs/Postman + gate completo).
