# API Design — SST Manager (estado atual)

> **Natureza da "API".** Há **duas** superfícies:
>
> 1. **Server Actions** (App Router) — a interface usada pela UI do app. São funções `"use server"`
>    invocadas via **POST** pelo framework (header `Next-Action: <id de build>` + payload do React);
>    **POST-only por design do Next** e **não** chamáveis "cruas" por Postman/cURL.
> 2. **REST API `/api/v1`** (Route Handlers) — superfície HTTP RESTful de verdade
>    (GET/POST/PUT/DELETE), testável por Postman. Reusa os mesmos repositórios/validação/erros das
>    actions. **É o que está na coleção Postman** (`sst-manager.postman_collection.json`).
>
> Este documento descreve o contrato lógico (assinaturas, entradas, retornos, erros) de tudo que
> existe hoje.

Atualizado conforme o código em `src/shared/server/actions/` e `src/app/api/`.

## Autenticação, identidade e tenant (PRÉ-REQUISITO)

> **Não há API própria de cadastro/login.** A identidade vive no **Clerk** (provedor de auth),
> conforme a fatia 005 (Modelo B). Operar qualquer CRUD exige: (1) ter conta no Clerk, (2) ter um
> tenant/escritório ativo. Ambos são resolvidos fora das nossas Server Actions.

**Fluxo de pré-requisito (estado atual):**

1. **Cadastro / login** — componentes **hospedados do Clerk** (`<SignUp>` / `<SignIn>`) nas
   páginas `/(public)/sign-up` e `/(public)/sign-in`. É o fluxo/Frontend API do Clerk — **não**
   um endpoint nosso. Não é chamável pela nossa API (nem por Postman como "API nossa").
2. **Provisionamento do escritório (free)** — no evento `user.created`, o Clerk dispara o
   **webhook** `POST /api/webhooks/clerk` → `handleClerkEvent` → `provisionPersonalTenant`, que
   cria o **tenant pessoal** (`orgs`, plano `free`) + **membership `owner`**. Toda identidade
   ganha um escritório próprio automaticamente, **mesmo free** (não vira organização no Clerk
   enquanto free — isso é futuro, no upgrade PRO). Não há passo manual de "criar org" para free.
3. **Sincronização** — o mesmo webhook trata `user.{created,updated,deleted}`,
   `organization.{created,updated,deleted}` e `organizationMembership.{created,updated,deleted}`,
   mantendo `users` e `org_memberships` em dia.
4. **Org ativa** — definida pelo cookie **`tenant_active_org`** e reconciliada por
   `reconcileActiveOrg` (Inv-2: a lista/seleção de tenant é dirigida pelos nossos vínculos, não
   pelo Clerk). Não há endpoint dedicado de troca nesta fatia.
5. **Onboarding** (`/(protected)/onboarding`) — usa componentes Clerk
   (`<CreateOrganization>` / `<OrganizationList>`) para o caminho de organização Clerk (multi-org/PRO).

### Endpoints HTTP de verdade (Route Handlers)

Estes **são** HTTP estável e chamáveis por Postman/cURL (ao contrário das Server Actions):

| Método | Rota                  | Auth                                                                | Retorno                                                                         |
| ------ | --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET`  | `/api/me`             | cookie de sessão Clerk                                              | `200 { userId, orgId }` · `401` (sem sessão) · `403 { error: "NO_ACTIVE_ORG" }` |
| `POST` | `/api/webhooks/clerk` | assinatura **Svix** (`svix-id`, `svix-timestamp`, `svix-signature`) | `200 ok\|ignored` · `400 invalid_payload\|invalid signature` · `500 db error`   |

> `GET /api/me` é o equivalente REST da Server Action `meAction`. O webhook **rejeita** payloads
> sem assinatura Svix válida (`verifyWebhook`), então só dispara com o signing secret do Clerk.

## REST API (`/api/v1`) — CRUD por HTTP

Camada **RESTful** sobre Route Handlers (`src/app/api/v1/...`), com **verbos de verdade**
(GET/POST/PUT/DELETE) — esta é a superfície testável por Postman/cURL. Reusa os mesmos
repositórios, schemas zod e mapeamento de erro das Server Actions (sem duplicar regra).
Coleção (arquivo **único**): `sst-manager.postman_collection.json` — as variáveis (`baseUrl`,
`devTenant`, `devRole`, ids) ficam na própria coleção (Variables); troque `baseUrl` para alternar
entre local/homolog/prod. (Mantemos só **um** arquivo Postman de propósito.)

> **Por que existe além das Server Actions?** Server Actions são **POST-only** por design do Next
> (doc oficial) e exigem o header `Next-Action` (hash de build) — logo, não-RESTful e não testáveis
> em Postman. Os Route Handlers são a forma Next-nativa de expor REST.

**Recursos** (todos sob `/api/v1`, escopados ao tenant ativo):

| Recurso                                                            | Verbos                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `/companies` · `/companies/{id}` · `/companies/{id}/dependents`    | GET, POST · GET, PUT, DELETE · GET                            |
| `/work-units` · `/work-units/{id}` · `/work-units/{id}/dependents` | GET, POST · GET, PUT, DELETE · GET                            |
| `/job-roles` · `/job-roles/{id}` · `/job-roles/{id}/dependents`    | GET, POST · GET, PUT, DELETE · GET                            |
| `/ges` · `/ges/{id}` · `/ges/{id}/dependents`                      | GET, POST · GET (inclui `exposedWorkers`), PUT, DELETE · GET  |
| `/ges/{id}/job-roles` · `/ges/{id}/job-roles/{linkId}`             | GET (`?available=true` p/ não vinculadas), POST · PUT, DELETE |
| `/employees` · `/employees/{id}`                                   | GET, POST · GET, PUT, DELETE                                  |

- **Filtros (query)**: list de cada recurso aceita `search`, `page`, `pageSize` + os filtros do
  recurso (`companyId`, `workUnitId`, `status`). Body de create/update = o mesmo `*Input` das actions.
- **Respostas**: recurso no corpo (`200`), `201` no create, `204` no delete. Erros:
  `{ error: { code, message, fields? } }` com HTTP `422 VALIDATION` · `409 DUPLICATE` ·
  `422 FK_NOT_FOUND` · `404 NOT_FOUND` · `403 FORBIDDEN`/`NO_TENANT_CONTEXT` · `401 UNAUTHORIZED`.

### Autenticação da REST API (2 modos) e os 3 ambientes

| Modo                  | Quando                                                      | Como                                                                                         | Tenant/papel                                   |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Auth real (Clerk)** | qualquer ambiente, **default**; **obrigatório em produção** | cookie `__session` (ou `Authorization: Bearer <session token>`) + cookie `tenant_active_org` | resolvidos por `requireOfficeStaff()` (sessão) |
| **Bypass DEV**        | só local/homolog, opt-in                                    | headers `x-dev-tenant`, `x-dev-role` (`owner\|collaborator\|client`), `x-dev-user`           | injetados; **não** toca no Clerk               |

O bypass é ligado por **env** e tem **kill-switch duro em produção**:

```bash
# local / homolog (.env.local)
APP_ENV=local              # ou: homolog
DEV_API_AUTH_BYPASS=true   # libera /api/v1 sem token Clerk
DEV_TENANT_ID=<orgId>      # tenant injetado (pode vir do header x-dev-tenant)
DEV_ROLE=owner

# produção
APP_ENV=production         # DEV_API_AUTH_BYPASS é IGNORADO; /api/v1 exige sessão Clerk
```

- Em produção, `isDevAuthBypassEnabled()` é sempre `false` (checa `APP_ENV !== "production"`),
  e o middleware (`proxy.ts`) **não** torna `/api/v1` público — Clerk protege normalmente.
- Em local/homolog com a flag, o middleware libera `/api/v1` e o handler resolve o contexto pelos
  headers `x-dev-*` (ou envs `DEV_*`). Permite testar isolamento trocando `x-dev-tenant` e o gate
  de papel com `x-dev-role: client` (→ `403`).
- **Auth real** (`/api/me` e o caminho default) usa a **org ativa do Clerk** via `requireOrgContext`
  para `/api/me`, enquanto `/api/v1` usa o **tenant interno** (Modelo B) via `requireOfficeStaff`.

## Sumário das actions/endpoints existentes

| Domínio                   | Arquivo                           | Superfície                                                                |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| REST API (Route Handlers) | `app/api/v1/**`                   | CRUD HTTP de companies/work-units/job-roles/ges(+vínculos)/employees      |
| Auth (Route Handler)      | `app/api/me/route.ts`             | `GET /api/me`                                                             |
| Webhook (Route Handler)   | `app/api/webhooks/clerk/route.ts` | `POST /api/webhooks/clerk` (provisiona tenant/sync)                       |
| Sessão / Identidade       | `actions/me.ts`                   | `meAction` (Server Action)                                                |
| Empresa                   | `actions/pgr/companies.ts`        | list, options, get, create, update, delete, dependents                    |
| Unidade de Obra           | `actions/pgr/work-units.ts`       | list, get, create, update, delete, dependents                             |
| Função (Cargo)            | `actions/pgr/job-roles.ts`        | list, get, create, update, delete, dependents                             |
| GES + vínculos            | `actions/pgr/ges.ts`              | list, get, create, update, delete, dependents + gestão de `ges_job_roles` |
| Funcionário               | `actions/pgr/employees.ts`        | list, get, create, update, delete + picker de função                      |

---

## Contrato de retorno — `ActionResult<T>`

Local: `src/shared/server/result.ts`. **Todas as actions de CRUD** retornam este envelope;
nenhuma exceção crua chega à UI.

```ts
type ActionError = {
  code: string; // ver tabela abaixo
  message: string; // mensagem curta exibível
  fields?: Record<string, string>; // erros por campo (origem zod)
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
```

> A `meAction` é anterior a este contrato e usa um envelope próprio (ver seção Sessão).

### Códigos de erro (canônicos)

Mapeados por `toActionError` (`src/shared/server/action-error.ts`). Erro inesperado é
**relançado** (nunca silenciado), caindo no error boundary do Next.

| code                | Origem                                   | HTTP equiv. | Quando                                                   |
| ------------------- | ---------------------------------------- | ----------- | -------------------------------------------------------- |
| `VALIDATION`        | `ZodError` (com `fields`); CHECK `23514` | 422         | Entrada inválida                                         |
| `DUPLICATE`         | UNIQUE `23505`                           | 409         | CNPJ/CPF/título/vínculo duplicado no escritório          |
| `FK_NOT_FOUND`      | FK `23503`; referência fora do tenant    | 422         | Empresa/obra/GES/função inexistente no escritório        |
| `FORBIDDEN`         | papel `client`                           | 403         | Membro não-equipe tentou operar                          |
| `NOT_FOUND`         | `getById` → `null`                       | 404         | Registro inexistente no escritório (inclui cross-tenant) |
| `NO_TENANT_CONTEXT` | sem escritório ativo                     | 403         | Sessão sem tenant resolvido                              |

## Pré-condições comuns (toda action de CRUD)

Encapsuladas em `officeAction(operation, fn, { audit? })` (`src/shared/server/office-action.ts`):

1. **Gate de papel** (`requireOfficeStaff`): apenas `owner`/`collaborator`; papel `client` →
   `FORBIDDEN`. Vale para leitura e escrita.
2. **Tenant da sessão**: `tenantId` vem de `requireTenantContext()`, **nunca** de input do
   cliente. Todo acesso roda em `withOrg(tenantId, …)` + RLS backstop por `org_id`.
3. **Validação**: escrita faz `schema.parse(input)` (zod) antes do repositório → falha vira
   `VALIDATION` com `fields`.
4. **Auditoria**: escritas emitem evento de fronteira sem PII; leituras não emitem em sucesso.
5. **Revalidação**: mutações chamam `revalidatePath` da(s) rota(s) afetada(s).

## Paginação

`src/shared/pagination.ts`. Entrada `{ page?, pageSize? }` (default `pageSize = 20`, clamp a
`PAGE_SIZE_MAX = 100`, `page >= 1`; inválidos caem nos defaults). Listas retornam
`Paginated<T> = { rows: T[]; total: number }`.

---

## Sessão / Identidade — `actions/me.ts`

| Action     | Entrada | Retorno                                                                                    |
| ---------- | ------- | ------------------------------------------------------------------------------------------ |
| `meAction` | —       | `{ ok: true; userId; orgId }` \| `{ ok: false; error: "UNAUTHORIZED" \| "NO_ACTIVE_ORG" }` |

Resolve o usuário autenticado e a org ativa da sessão (Clerk). Envelope próprio (não
`ActionResult`).

## Empresa — `actions/pgr/companies.ts`

| Action                       | Entrada                         | Retorno (`data`)                              |
| ---------------------------- | ------------------------------- | --------------------------------------------- |
| `listCompaniesAction`        | `{ search?, page?, pageSize? }` | `{ rows: CompanyListItem[]; total }`          |
| `listCompanyOptionsAction`   | —                               | `CompanyOption[]` (id, razaoSocial, endereço) |
| `getCompanyAction`           | `id`                            | `Company` (null → `NOT_FOUND`)                |
| `createCompanyAction`        | `CompanyInput`                  | `Company` (CNPJ dup → `DUPLICATE`)            |
| `updateCompanyAction`        | `id, CompanyInput`              | `Company`                                     |
| `deleteCompanyAction`        | `id`                            | `{ id }` (cascata pelo banco)                 |
| `getCompanyDependentsAction` | `id`                            | `{ workUnits, ges, jobRoles, employees }`     |

**`CompanyInput`**: `razaoSocial*`, `riskGrade*` (1–4), `cnpj?` (14 díg. se preenchido),
`nomeFantasia?`, `phone?`, `email?`, `cnae?`, `mainActivity?`, `logoPath?`,
`zipCode? street? number? complement? district? city? state?`.
**`CompanyListItem`**: `{ id, razaoSocial, cnpj, city, state }`.

## Unidade de Obra — `actions/pgr/work-units.ts`

| Action                        | Entrada                                     | Retorno                                              |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `listWorkUnitsAction`         | `{ companyId?, search?, page?, pageSize? }` | `{ rows: WorkUnit[]; total }`                        |
| `getWorkUnitAction`           | `id`                                        | `WorkUnit`                                           |
| `createWorkUnitAction`        | `WorkUnitInput`                             | `WorkUnit` (empresa fora do tenant → `FK_NOT_FOUND`) |
| `updateWorkUnitAction`        | `id, WorkUnitInput`                         | `WorkUnit`                                           |
| `deleteWorkUnitAction`        | `id`                                        | `{ id }`                                             |
| `getWorkUnitDependentsAction` | `id`                                        | `{ ges }`                                            |

**`WorkUnitInput`**: `companyId*`, `name*`, `description*`, `contractNumber?`, endereço (`zipCode?…state?`).

## Função (Cargo) — `actions/pgr/job-roles.ts`

| Action                       | Entrada                                     | Retorno                                         |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------- |
| `listJobRolesAction`         | `{ companyId?, search?, page?, pageSize? }` | `{ rows: JobRole[]; total }`                    |
| `getJobRoleAction`           | `id`                                        | `JobRole`                                       |
| `createJobRoleAction`        | `JobRoleInput`                              | `JobRole` (título dup na empresa → `DUPLICATE`) |
| `updateJobRoleAction`        | `id, JobRoleInput`                          | `JobRole`                                       |
| `deleteJobRoleAction`        | `id`                                        | `{ id }`                                        |
| `getJobRoleDependentsAction` | `id`                                        | `{ gesLinks, employees }`                       |

**`JobRoleInput`**: `companyId*`, `title*`, `cbo?`, `workSchedule?`, `description?`.

## GES + vínculos — `actions/pgr/ges.ts`

| Action                        | Entrada                                                  | Retorno                                                 |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `listGesAction`               | `{ companyId?, workUnitId?, search?, page?, pageSize? }` | `{ rows: GesListItem[]; total; totalWorkers }`          |
| `getGesAction`                | `id`                                                     | `{ ges: Ges; exposedWorkers }`                          |
| `createGesAction`             | `GesInput`                                               | `Ges` (obra fora da empresa/tenant → `FK_NOT_FOUND`)    |
| `updateGesAction`             | `id, GesInput`                                           | `Ges`                                                   |
| `deleteGesAction`             | `id`                                                     | `{ id }` (cascata em vínculos; funcionários → GES nulo) |
| `getGesDependentsAction`      | `id`                                                     | `{ jobRoleLinks, employees }`                           |
| `listGesJobRolesAction`       | `gesId`                                                  | `GesJobRoleItem[]`                                      |
| `listAvailableJobRolesAction` | `gesId`                                                  | `JobRoleOption[]` (funções da empresa não vinculadas)   |
| `addGesJobRoleAction`         | `{ gesId, jobRoleId, workerCount, workSchedule? }`       | `{ gesId }` (≤0 → `VALIDATION`; dup → `DUPLICATE`)      |
| `updateGesJobRoleAction`      | `id, gesId, { workerCount, workSchedule? }`              | `{ id }`                                                |
| `removeGesJobRoleAction`      | `id, gesId`                                              | `{ id }`                                                |

**`GesInput`**: `companyId*`, `workUnitId*`, `name*`, `processDescription? constructionType?
ceilingHeight? floor? roof? lighting? ventilation? otherCharacteristics?`.
**`GesListItem`**: `{ id, name, processDescription, exposedWorkers }` — `exposedWorkers` é
**derivado** (`SUM(worker_count)` das funções vinculadas), somente leitura, 0 sem vínculos.
**`GesJobRoleItem`**: `{ id, jobRoleId, title, workerCount, workSchedule }`.
**`JobRoleOption`**: `{ jobRoleId, title }`.

## Funcionário — `actions/pgr/employees.ts`

| Action                   | Entrada                                              | Retorno                                                  |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| `listEmployeesAction`    | `{ companyId?, status?, search?, page?, pageSize? }` | `{ rows: EmployeeListItem[]; total }`                    |
| `getEmployeeAction`      | `id`                                                 | `Employee`                                               |
| `createEmployeeAction`   | `EmployeeInput`                                      | `Employee` (CPF dup → `DUPLICATE`)                       |
| `updateEmployeeAction`   | `id, EmployeeInput`                                  | `Employee`                                               |
| `deleteEmployeeAction`   | `id`                                                 | `{ id }`                                                 |
| `listGesFunctionsAction` | `gesId`                                              | `JobRoleOption[]` (picker: só funções vinculadas ao GES) |

**`EmployeeInput`**: `companyId*`, `fullName*`, `cpf*` (11 díg.), `gesId?`, `jobRoleId?`
(exige `gesId` e vínculo existente no GES), `status?` (`active`|`on_leave`|`dismissed`, default
`active`), `sex?` (`male`|`female`|`not_informed`), `maritalStatus?`
(`single`|`married`|`divorced`|`widowed`|`stable_union`), `birthDate? admissionDate?
dismissalDate? badgeValidUntil?` (datas), `phone? email? rg? badgeNumber? registration?
bloodType? photoPath?`, endereço (`zipCode?…state?`).
**`EmployeeListItem`**: `{ id, fullName, status, companyName, gesName }`.

---

## Rotas de UI (superfície HTTP navegável)

Área autenticada `(protected)` — layout aplica `requireTenantContext`; cada página de CRUD
aplica `requireOfficeStaffPage()` (papel `client` → `forbidden()`); detalhe/edição por id
inexistente ou de outro escritório → `notFound()`.

| Rota                                                                         | Descrição                                                       |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/dashboard`                                                                 | Painel (área autenticada)                                       |
| `/companies` · `/companies/new` · `/companies/[id]/edit`                     | Empresa (lista paginada / criar / detalhe=edição)               |
| `/work-units` · `/work-units/new` · `/work-units/[id]/edit`                  | Unidade de obra (+ copiar endereço da empresa)                  |
| `/job-roles` · `/job-roles/new` · `/job-roles/[id]/edit`                     | Função                                                          |
| `/ges` · `/ges/new` · `/ges/[id]/edit`                                       | GES (lista + card "Total"; edição gerencia vínculos e expostos) |
| `/employees` · `/employees/new` · `/employees/[id]` · `/employees/[id]/edit` | Funcionário (lista filtrável / criar / ficha / editar)          |

## Invariantes de isolamento (multi-tenant)

- Tenant ativo sempre da sessão; nunca de input do cliente.
- Detalhe/edição/exclusão de id de outro escritório → `NOT_FOUND` (nunca dado alheio).
- Papel `client` → `FORBIDDEN`/`forbidden()` em qualquer operação.
- `UNIQUE(org_id, cpf)` / `(org_id, cnpj)`: mesmo valor aceito entre escritórios, bloqueado no
  mesmo escritório.
- Nº de expostos do GES é derivado e somente leitura.

## Nota sobre teste HTTP "cru"

Se for necessário um endpoint HTTP de fato testável (Postman/cURL sem o framework), seria
preciso adicionar Route Handlers (`app/api/.../route.ts`) que reusem os mesmos repositórios e o
contrato `ActionResult`. Hoje isso não existe (decisão de arquitetura: Server Actions, sem API
separada).
