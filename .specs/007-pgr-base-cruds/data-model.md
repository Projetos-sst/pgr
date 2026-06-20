# Phase 1 — Data Model: CRUDs base do PGR

> **Sem mudança de schema.** As tabelas, colunas, enums e constraints já existem (006, migration
> `0005`). A fonte da verdade do schema são os arquivos `src/shared/db/schema/*` e os briefings
> em `docs/briefings/007-*.md`. Esta fatia adiciona **operações** (leitura/escrita) e **modelos de
> leitura (DTO)**, não estruturas de dados novas.

## Entidades (resumo — detalhe nos briefings)

| Entidade | Tabela | Obrigatórios (CRUD) | Unicidade (por tenant) | Integridade relevante |
| --- | --- | --- | --- | --- |
| Empresa | `companies` | `razao_social`, `risk_grade` (1–4) | `(org_id, cnpj)` | `risk_grade` CHECK 1..4; cnpj 14 díg. se preenchido |
| Unidade de Obra | `work_units` | `name`, `description`, `company_id` | — | FK `company_id` cascade |
| Função | `job_roles` | `title`, `company_id` | `(org_id, company_id, title)` | FK `company_id` cascade |
| GES | `ges` | `name`, `company_id`, `work_unit_id` | — | FK cascade; `work_unit_id` ⊂ `company_id` |
| Vínculo GES↔Função | `ges_job_roles` | `ges_id`, `job_role_id`, `worker_count`>0 | `(org_id, ges_id, job_role_id)` | CHECK `worker_count>0`; cascade |
| Funcionário | `employees` | `full_name`, `cpf`, `company_id` | `(org_id, cpf)` | `ges_id`/`job_role_id` SET NULL; enums |

Enums (já existentes): `category_type(epi,machine)`, `employee_sex(male,female,not_informed)`,
`marital_status(single,married,divorced,widowed,stable_union)`,
`employee_status(active,on_leave,dismissed)`.

## Nº de trabalhadores expostos (derivado)

`SUM(ges_job_roles.worker_count)` agrupado por `ges_id`, no tenant ativo. Helpers existentes em
`src/shared/db/repositories/ges.ts` (`countExposedWorkersByGes`, `exposedWorkersByGesMap`) e
puros em `src/shared/domains/pgr/exposed-workers.ts`. **Sem coluna, sem trigger, nunca input.**

## Operações por entidade (a implementar)

Convenção: todas recebem `tenantId: string` (da sessão), rodam em `withOrg`, escrita via
`auditedTenantWrite`. `getById` retorna `null` quando o id não existe no tenant (→ 404 na UI).
`list*` retorna `{ rows, total }` (paginação offset, `pageSize` padrão 20).

### Empresa (`repositories/companies.ts`)
- `listCompanies(tenantId, { search?, page?, pageSize? })` → `{ rows: CompanyListItem[], total }`
  — **estender** (busca por razão social/CNPJ + paginação).
- `getCompanyById(tenantId, id)` → `Company | null` — **criar**.
- `createCompany(tenantId, input: CompanyInput)` → `Company` — **estender input** p/ todos os
  campos da 006 (endereço, risk_grade, cnae, main_activity, contatos, nome_fantasia, logo_path).
- `updateCompany(tenantId, id, input: CompanyInput)` → `Company | null` — **criar**.
- `deleteCompany(tenantId, id)` → `boolean` — **criar** (cascata garantida pelo banco).
- `countCompanyDependents(tenantId, id)` → `{ workUnits, ges, jobRoles, employees }` — **criar**
  (aviso de exclusão).

### Unidade de Obra (`repositories/work-units.ts`)
- `listWorkUnits(tenantId, { companyId?, search?, page?, pageSize? })` → `{ rows, total }` — **estender**.
- `getWorkUnitById(tenantId, id)` → `WorkUnit | null` — **criar**.
- `createWorkUnit` / `updateWorkUnit` / `deleteWorkUnit` — **criar update/delete**.
- `countWorkUnitDependents(tenantId, id)` → `{ ges }` — **criar**.

### Função (`repositories/job-roles.ts`)
- `listJobRoles(tenantId, { companyId?, search?, page?, pageSize? })` → `{ rows, total }` — **estender**.
- `getJobRoleById` / `updateJobRole` / `deleteJobRole` — **criar**.
- `countJobRoleDependents(tenantId, id)` → `{ gesLinks, employees }` — **criar** (aviso).

### GES (`repositories/ges.ts`)
- `listGes(tenantId, { companyId?, workUnitId?, search?, page?, pageSize? })` →
  `{ rows: GesListItem[], total, totalWorkers }` — **estender** (filtros + card "Total" derivado
  via `exposedWorkersByGesMap`).
- `getGesById(tenantId, id)` → `Ges | null` — **criar**.
- `updateGes` / `deleteGes` — **criar**.
- (reuso) `countExposedWorkersByGes`, `exposedWorkersByGesMap`.

### Vínculo GES↔Função (`repositories/ges-job-roles.ts`)
- `listGesJobRoles(tenantId, { gesId })` → `GesJobRoleItem[]` (join `job_roles` p/ título) — **estender**.
- `listAvailableJobRolesForGes(tenantId, gesId, companyId)` → `JobRoleOption[]` (funções da
  empresa **não** vinculadas ao GES) — **criar**.
- `updateGesJobRole(tenantId, id, { workerCount, workSchedule })` — **criar**.
- `deleteGesJobRole(tenantId, id)` — **criar**.
- (reuso) `createGesJobRole`.

### Funcionário (`repositories/employees.ts`)
- `listEmployees(tenantId, { companyId?, status?, search?, page?, pageSize? })` →
  `{ rows: EmployeeListItem[], total }` (join p/ GES/Obra/Empresa na lista) — **estender**.
- `getEmployeeById(tenantId, id)` → `Employee | null` — **criar**.
- `updateEmployee(tenantId, id, input)` — **criar** (revalida cpf/enums).
- `deleteEmployee(tenantId, id)` — **criar**.
- Picker de Função do funcionário (funções vinculadas ao GES): **reutiliza** `listGesJobRoles`
  (repo, nome canônico); exposto pela action `listGesFunctionsAction(gesId)`. Sem query nova.

## Modelos de leitura (DTO) — `domains/pgr/<entity>.ts`

- **CompanyListItem**: `id, razaoSocial, cnpj, city, state` (colunas da lista).
- **GesListItem**: `id, name, processDescription, exposedWorkers` (derivado).
- **EmployeeListItem**: `id, fullName, status, companyName, gesName` (sem PII além do necessário).
- **JobRoleOption / GesJobRoleItem**: `{ jobRoleId, title }` / `{ id, jobRoleId, title, workerCount, workSchedule }`.
- Mapeadores `toXListItem(row)` puros e testáveis; entidades completas (`Company`, `Employee` etc.)
  reutilizam os tipos inferidos do Drizzle no detalhe/edição.

## Estados (sem máquina de estado nova)

- `employees.status` (`active`/`on_leave`/`dismissed`) é um campo editável, não um workflow.
  Default `active` na criação. Sem transições restritas nesta fatia.
- Exclusão: hard delete; integridade por cascade/SET NULL do banco (006). Sem soft delete.
