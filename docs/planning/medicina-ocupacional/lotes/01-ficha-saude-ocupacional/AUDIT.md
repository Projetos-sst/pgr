# Lote 01 — AUDIT (código atual, HEAD `d6b787c`)

> Leitura direta do código em 2026-10-21, sem executar nada. Linhas citadas são do HEAD `d6b787c`
> (= `origin/develop`). Complementa, sem repetir, [`../../AUDIT-UX.md`](../../AUDIT-UX.md) §4 e
> [`../../GAP-MATRIX.md`](../../GAP-MATRIX.md) MED-05…08. [README do lote](README.md) · [PLAN](PLAN.md)

## 1. Navegação

| Arquivo:linha                                     | Fato                                                                                                                             | Consequência para o lote                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app/(protected)/_components/nav-menu.tsx:25` | `const NAV: NavEntry[]` estático                                                                                                 | O item novo entra direto na lista                                                                    |
| `nav-menu.tsx:102-110`                            | Grupo "Medicina do Trabalho" (`iconName: "activity"`): `Exames e ASO` → `/health-exams` (l.107) e `Médicos` → `/medicos` (l.108) | Inserir `Painel` → `/medicine` como 1º item. **A #112 altera o mesmo bloco** (+ "Riscos para PCMSO") |
| `nav-menu.tsx:439-443`                            | `NavMenu({ showOnboardingBadge })`: não recebe módulos nem papel                                                                 | Menu continua igual para todo office staff; o gating fica no conteúdo das telas                      |
| `nav-menu.tsx:141-399`                            | `switch` de ícones; não existe ícone de "painel"; existem `activity`, `stethoscope`, `clipboard-list`, `clipboard-check` etc.    | Reusar um ícone existente; SVG novo só se pedido                                                     |
| `nav-menu.tsx:402-405`                            | `isActive` = igualdade ou prefixo `href/`                                                                                        | `/medicine` não conflita com `/medicos` nem `/health-exams`                                          |

## 2. `/health-exams`

| Arquivo:linha                                            | Fato                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/app/(protected)/health-exams/page.tsx:30`           | `dynamic = "force-dynamic"`                                                                               |
| `page.tsx:33`                                            | `DUE_WINDOW_DAYS = 30` local (mesma janela que o painel deve usar → promover para o domínio)              |
| `page.tsx:35-40`                                         | `VALIDITY_COLOR` com hex cru (dívida de token, AUDIT-UX §4.2)                                             |
| `page.tsx:48`                                            | `SearchParams = { search, examType, page }` — **sem `companyId`**                                         |
| `page.tsx:55`                                            | `requireOfficeStaffPage()` (owner/collaborator; `client` → `forbidden()`)                                 |
| `page.tsx:63`                                            | `listHealthExamsAction({ search: sp.search, examType, page })`                                            |
| `page.tsx:64`                                            | **`result.ok ? result.data : { rows: [], total: 0 }` — erro vira "lista vazia"** (falso negativo clínico) |
| `page.tsx:77-81`                                         | `HealthExamFilters` recebe só `basePath`, `search`, `examType`                                            |
| `page.tsx:85-95`                                         | `EmptyState` "Nenhum exame registrado." — mostrado também em erro e quando nenhuma empresa tem Medicina   |
| `page.tsx:98`                                            | `DataGrid minWidth={900}` (rola dentro do cartão no mobile)                                               |
| `page.tsx:112-119`                                       | `classifyDocumentValidity` + `examBadge` com `DUE_WINDOW_DAYS`                                            |
| `page.tsx:139`                                           | `StatusBadge` importado de `../_ui/data-list` (l.22)                                                      |
| `page.tsx:143-151`                                       | Link "ver/editar" → `/health-exams/${id}/edit` (**não existe `/health-exams/[id]` de leitura**)           |
| `page.tsx:158-164`                                       | `ListFooter params={{ search, examType }}`                                                                |
| `health-exams/_components/health-exam-filters.tsx:12-20` | Props `basePath`, `search?`, `examType?`                                                                  |
| `health-exam-filters.tsx:24`                             | `<form action={basePath} method="get" className="contents">`                                              |
| `health-exam-filters.tsx:47-68`                          | `<select name="examType">` com auto-submit e `aria-label` (padrão a copiar para empresa)                  |
| `health-exams/new/page.tsx:11`                           | `NewHealthExamPage()` **não lê `searchParams`** → não há pré-seleção                                      |
| `new/page.tsx:14`                                        | `listEmployeesAction({ pageSize: 200, module: "medicine" })` — **limite silencioso de 200**               |
| `new/page.tsx:17-23`                                     | Falha ao listar funcionários/médicos vira `[]` (select vazio sem aviso)                                   |
| `health-exams/[id]/edit/page.tsx:23`                     | Mesmo limite de 200; l.26 `notFound()` se o exame não é do tenant                                         |
| `health-exams/_components/health-exam-form.tsx:37-38`    | `EmployeeOption {id, fullName}`, `DoctorOption {id, name, crm}`                                           |
| `health-exam-form.tsx:40-49`                             | `HealthExamFormInitial` exige o objeto completo (não serve para só pré-selecionar)                        |
| `health-exam-form.tsx:87`                                | Após salvar: `router.push("/health-exams")` fixo (não volta à ficha)                                      |
| `health-exam-form.tsx:101-110`                           | `SelectField name="employeeId"` com `defaultValue={initial?.employeeId ?? ""}`                            |
| `health-exam-form.tsx:152-157`                           | `certificatePath` texto livre (placeholder "/docs/aso/joao-2026.pdf")                                     |
| `health-exam-form.tsx:158-165`                           | "Observações" (`notes`) livre, placeholder "Restrições, recomendações…", **sem aviso**                    |
| `health-exam-form.tsx:169`                               | `CancelLink href="/health-exams"` fixo                                                                    |

## 3. `/medicos`

`src/app/(protected)/medicos/page.tsx:43-46` carrega médicos e clínicas; **l.47** repete o padrão erro → `{ rows: [], total: 0 }`;
l.48 clínicas → `[]` em erro; l.69-79 `EmptyState` "Nenhum médico cadastrado." também em erro.

## 4. `/employees/[id]`

| Arquivo:linha                                       | Fato                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/app/(protected)/employees/[id]/page.tsx:51-57` | `Placeholder` genérico ("— disponível em fase futura.")                                                       |
| `page.tsx:64-67`                                    | `requireOfficeStaffPage()`; `getEmployeeAction(id)`; `notFound()` se não for do tenant                        |
| `page.tsx:70-88`                                    | `Promise.all` de empresa, GES, função, entregas de EPI, ficha de EPI, treinamentos, conformidade              |
| `page.tsx:90-94`                                    | Mesmo padrão erro → `[]` nos treinamentos e entregas (fora do escopo; não corrigir aqui)                      |
| `page.tsx:123-130`                                  | Já mostra CPF e **tipo sanguíneo** (`employee.bloodType`) a todo office staff — existente, **não ampliar**    |
| `page.tsx:228-268`                                  | Seção "Treinamentos": `<section className="glass-card …">` + `<h2>` + tabela — molde visual para a nova seção |
| `page.tsx:314-317`                                  | Grade com `Placeholder title="Histórico"` (l.315) e `Placeholder title="Ordens de serviço"` (l.316)           |

**Divergência com a Fase 0:** FIRST-MVP §2 passo 4 diz "no lugar do placeholder da l.315" e GAP-MATRIX MED-06 diz "l.314".
O placeholder da l.315 é **"Histórico"** (genérico), não um placeholder de saúde. O [PLAN §3.4](PLAN.md#34-employeesid-seção-saúde-ocupacional)
propõe inserir a seção como bloco próprio e deixa a remoção do "Histórico" para decisão do Carlos.

## 5. Repositórios

| Arquivo:linha                                         | Assinatura / fato                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/db/repositories/health-exams.ts:26-47`    | `assertRefsInTenant`: funcionário do tenant (l.31-36) → `assertCompanyModuleTx(tx, orgId, emp.companyId, "medicine")` (l.37); médico do tenant (l.39-46)                                                                                                |
| `health-exams.ts:49-52`                               | `ListHealthExamsParams = PageParams & { search?: string; examType?: ExamType }` — **sem `employeeId`/`companyId`**                                                                                                                                      |
| `health-exams.ts:54-108`                              | `listHealthExams(orgId, params)`: `innerJoin(employees)` (l.95), `leftJoin(medicos)` (l.96), `orderBy(desc(performedAt))` (l.98); contagem com o mesmo `where` e o mesmo join de `employees` (l.101-105)                                                |
| `health-exams.ts:110-122`                             | `getHealthExamById(orgId, id)`                                                                                                                                                                                                                          |
| `health-exams.ts:124-148` · `150-176` · `178-188`     | create/update (com `auditedTenantWrite` + `assertRefsInTenant`) e delete físico                                                                                                                                                                         |
| `src/shared/db/repositories/employees.ts:22-28`       | `ListEmployeesParams = PageParams & { module?, companyId?, status?, search?, gesId? }`                                                                                                                                                                  |
| `employees.ts:104-167`                                | `listEmployees`: `companyModuleScope(employees.orgId, employees.companyId, module)` quando há `module` (l.110-114); `companyId` (l.115); busca em nome, GES e função (l.119-129); retorna `companyName`, `gesName`, `jobRoleTitle`, `serviceOrderCount` |
| `employees.ts:169-181`                                | `getEmployeeById(orgId, id)` (sem filtro de módulo: cadastro comum)                                                                                                                                                                                     |
| `src/shared/db/repositories/companies.ts:133-162`     | `listCompanyOptions(orgId, requestedModule?)` com `companyModuleScope` quando há módulo; ordena por razão social                                                                                                                                        |
| `src/shared/db/repositories/company-modules.ts:16-35` | `assertCompanyModuleTx(tx, orgId, companyId, module)` → `ForbiddenError("Serviço não habilitado para esta empresa.")`                                                                                                                                   |
| `company-modules.ts:37-59`                            | `getCompanyModules(orgId, companyId)` → `[{ module, enabled }]`; `NotFoundError` se a empresa não é do tenant                                                                                                                                           |
| `src/shared/db/schema/module-policy.ts:5-13`          | `companyModuleScope` = `exists (select 1 from company_modules …)` (usado na aplicação **e** em policy)                                                                                                                                                  |
| `src/shared/db/schema/health-exams.ts:63-70`          | Policy RESTRICTIVE `health_exams_module_access` (USING + WITH CHECK) via `employees.company_id` **atual**                                                                                                                                               |

`employees` **não** tem policy de módulo: a restrição à Medicina na lista de funcionários depende de passar `module: "medicine"`.

## 6. Actions, REST e domínio

| Arquivo:linha                                                 | Fato                                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/server/actions/pgr/health-exams.ts:19-25`         | `listHealthExamsAction(params: repo.ListHealthExamsParams)` repassa os params sem validar                                                      |
| `actions/pgr/health-exams.ts:35-48`                           | `createHealthExamAction` (`audit: true`), `revalidatePath("/health-exams")` (l.43)                                                             |
| `src/shared/server/actions/pgr/employees.ts:27-33`            | `listEmployeesAction(params)`                                                                                                                  |
| `src/shared/server/actions/pgr/companies.ts:33-39`            | `listCompanyOptionsAction(module?)`                                                                                                            |
| `src/shared/server/actions/platform/company-modules.ts:11-18` | `getCompanyModuleOverviewAction(companyId, page)` → `{ modules, history }` (office staff); REST `GET /api/v1/companies/[id]/modules` já existe |
| `src/app/api/v1/health-exams/route.ts:18-26`                  | `GET` lê `search`, `examType` e paginação; **não lê `employeeId`/`companyId`**                                                                 |
| `src/app/api/v1/health-exams/[id]/route.ts:13-30`             | GET/PUT por id                                                                                                                                 |
| `src/app/api/v1/dashboard/summary/route.ts:9-11`              | Precedente de read-model só `GET` com `restHandler`                                                                                            |
| `src/shared/domains/pgr/health-exams.ts:62-74`                | `examBadge(validUntil, aptitude, {today, dueWindowDays})`: vencido → vermelho; a vencer → âmbar; senão aptidão                                 |
| `domains/pgr/health-exams.ts:100-110`                         | `HealthExamListItem` **não inclui `notes`** nem `certificatePath` (bom: manter assim)                                                          |
| `src/shared/domains/documents/validity.ts:16-24`              | `classifyDocumentValidity`: `null` → `no_expiry`; `< today` → `expired`; `<= today+janela` → `due_soon` (inclusivo); senão `ok`                |

## 7. Primitives `_ui` e componentes

| Arquivo:linha                                                          | Fato                                                                                                                                                   | Uso no lote                                                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(protected)/_ui/status-badge.tsx:1-32`                        | `StatusBadge({tone, label})`, 4 tons, classes de token; **3 importadores** (inspeções)                                                                 | não usar                                                                                                                                    |
| `src/app/(protected)/_ui/data-list.tsx:347-379`                        | `StatusBadge({tone, children})`, 6 tons, `style` com hex; **23 importadores**, incluindo `/health-exams`                                               | **usar esta** (consistência com as telas de Medicina; unificação é do Douglas, MED-DEC-17)                                                  |
| `_ui/list.tsx:4-60`                                                    | `PageHeader` (ícone em `bg-primary`)                                                                                                                   | reutilizar                                                                                                                                  |
| `_ui/list.tsx:73-107`                                                  | `EmptyState({title, message, isFlat})` — **sem prop de ação/CTA**                                                                                      | estender com `action?` opcional                                                                                                             |
| `_ui/list.tsx:263,272` × `_ui/data-list.tsx:15,19`                     | `ListCard`/`ListToolbar` duplicados                                                                                                                    | usar os de `data-list.tsx` (como `/health-exams`)                                                                                           |
| `_ui/skeleton.tsx:7-14`                                                | `Skeleton` decorativo (`aria-hidden`); quem anuncia é o container `role="status"`                                                                      | `loading.tsx` do painel                                                                                                                     |
| `_ui/auto-submit-select.tsx`                                           | `AutoSubmitSelect({id, name, defaultValue, options, emptyLabel})`                                                                                      | seletor de empresa                                                                                                                          |
| `_ui/field-hint.tsx`                                                   | `FieldHint` com prefixo fixo **"Dica da IA:"**                                                                                                         | **não** usar para o aviso de Observações (não é IA)                                                                                         |
| `_ui/form.tsx:210-240`                                                 | `TextField` sem prop de dica                                                                                                                           | aviso de Observações exige prop nova ou texto ao lado (só se MED-DEC-18)                                                                    |
| `src/app/_components/error-state.tsx:15-32`                            | `ErrorState({code, eyebrow, title, description, actions})`                                                                                             | identidade visual a reaproveitar                                                                                                            |
| `error-state.tsx:34` e `:53`                                           | Renderiza **`<main>`** e **`<h1>`**                                                                                                                    | **não embutir** dentro das páginas: o layout protegido já tem `<main>` (`src/app/(protected)/layout.tsx:91`) e o `PageHeader` já tem `<h1>` |
| `src/app/(protected)/dashboard/_components/dashboard-widgets.tsx:6-76` | `StatCard({label, value, href, eyebrow, subtext, icon, highlight})`, **`href` obrigatório** (sempre `<Link>`); hex `#5b63f5` (l.27) e `#9095ad` (l.57) | promover para `_ui` com `href` opcional; importado também por `dashboard/_components/dashboard-client-wrapper.tsx`                          |
| `find src/app -name loading.tsx`                                       | nenhum resultado                                                                                                                                       | o painel será o primeiro `loading.tsx`                                                                                                      |

## 8. Testes e helpers existentes

| Arquivo:linha                                                               | Fato                                                                                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/integration/pgr/health-exams.test.ts:3-9`                    | Mocks: `@/shared/db/env` → `INTEGRATION_APP_RUNTIME_URL`; `next/cache`; `require-office-staff`                                                        |
| `health-exams.test.ts:24-26`                                                | `shouldRun` exige `INTEGRATION_APP_RUNTIME_URL` **e** `INTEGRATION_DATABASE_URL`                                                                      |
| `health-exams.test.ts:28-30`                                                | `mockedGate` + `asOwner(tenantId)`                                                                                                                    |
| `health-exams.test.ts:48,88,114,132,143,154`                                | CRUD; busca/filtro; médico cross-tenant → FK_NOT_FOUND; funcionário cross-tenant → FK_NOT_FOUND; data futura → VALIDATION; cross-tenant → NOT_FOUND   |
| `src/__tests__/integration/pgr/rest-health-exams.test.ts:9-15`              | Mocks (inclui `OFFICE_STAFF_ROLES`); importa handlers direto (l.17-22); **roda no Jest** (não está entre as 8 excluídas)                              |
| `rest-health-exams.test.ts:79-156`                                          | GET vazio; POST 201; busca por rótulo; 422 VALIDATION/FK_NOT_FOUND; 403 client; 404 cross-tenant; PUT/DELETE 204                                      |
| `src/__tests__/integration/platform/company-modules.test.ts:21,43,66,83,94` | Backfill 0053; empresa nova sem módulo; revogar PGR mantém Medicina; **revogar Medicina oculta exames sem apagar** (l.83); isolamento de habilitações |
| `src/__tests__/integration/_helpers/db.ts:5-19`                             | `appRuntimeClient()` usa `INTEGRATION_DATABASE_URL`; `adminClient()` usa `INTEGRATION_DATABASE_URL_ADMIN ?? INTEGRATION_DATABASE_URL`                 |
| `_helpers/db.ts:54`                                                         | `applyMigrations`: `.sql` em ordem alfabética, split por `--> statement-breakpoint`                                                                   |
| `src/__tests__/integration/_helpers/pgr-seed.ts:3-50`                       | `PGR_IDS` fixos (uma empresa por tenant: `companyA`/`companyB`, `employeeA`/`employeeB`)                                                              |
| `pgr-seed.ts:52`, `:64`                                                     | `seedPgrBase` habilita `pgr` e `medicine` para todas as empresas; **não semeia `medicos` nem `health_exams`**; **não há 2ª empresa no mesmo tenant**  |
| `src/__tests__/integration/_helpers/isolation-suite.ts:12-23,25`            | `runIsolationSuite({table, seededCountA, crossTenantInsertSql, extraSeedSql?})` — **não cobre `health_exams`** hoje                                   |

**Nota de ambiente (inconsistência real):** as suítes de exames usam `INTEGRATION_APP_RUNTIME_URL` (runtime) + `INTEGRATION_DATABASE_URL`
(admin), enquanto `_helpers/db.ts` e o CLAUDE.md descrevem `INTEGRATION_DATABASE_URL` (+ `_ADMIN`). Sem as duas primeiras, as
suítes de Medicina saem como **skipped** e o comando parece verde ([`../../AUDIT-LINEAR-QA.md`](../../AUDIT-LINEAR-QA.md) §5.3).

## 9. Lacunas que o lote fecha

| Lacuna                                     | MED         | Onde                          |
| ------------------------------------------ | ----------- | ----------------------------- |
| Sem visão da Medicina por empresa (painel) | MED-07      | §1, §7                        |
| Sem visão por funcionário                  | MED-06      | §4                            |
| Erro tratado como vazio                    | MED-08      | §2 (l.64), §3 (l.47)          |
| Sem filtro por empresa em exames           | MED-05 (UI) | §2 (l.48, l.63), §5 (l.49-52) |
| Sem `loading.tsx`                          | MED-08      | §7                            |
| Sem seed nem isolation suite de saúde      | MED-36      | §8                            |

## 10. Lacunas que o lote **não** fecha (registradas)

- `health_exams` sem `company_id` próprio: o filtro por empresa usa a empresa **atual** do funcionário (Lote 02).
- DELETE físico e CASCADE de exames (Lote 02, MED-DEC-15).
- `notes` livre sem segregação (MED-DEC-11/14); só o aviso opcional (MED-DEC-18).
- Menu estático; pílulas abaixo de AA; `text-subtle` abaixo de AA (MED-DEC-17).
- Limite de 200 funcionários no formulário genérico `/health-exams/new` sem pré-seleção (ver PLAN §12).

## 11. Riscos

Ver [PLAN §10](PLAN.md#10-riscos).
