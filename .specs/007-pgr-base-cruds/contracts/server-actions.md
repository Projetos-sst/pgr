# Contrato — Server Actions (PGR base CRUDs)

Todas em `src/shared/server/actions/pgr/<entity>.ts`, `"use server"`. Todas retornam
`ActionResult<T>` (ver `action-result.md`). Pré-condições comuns, na ordem:

1. `requireOfficeStaff()` — nega papel `client` (`FORBIDDEN`); sem tenant → `NO_TENANT_CONTEXT`.
2. `schema.safeParse(input)` (zod do domínio) — falha → `VALIDATION` com `fields`.
3. Repositório dentro de `withOrg(tenantId, …)` — `tenantId` da sessão, nunca do input.
4. `revalidatePath(...)` nas mutações; mapear erro do Postgres → `DUPLICATE`/`FK_NOT_FOUND`.

> O `tenantId` **nunca** é parâmetro vindo do cliente. As actions o obtêm de
> `requireTenantContext()`/`requireOfficeStaff()`.

## Empresa — `actions/pgr/companies.ts`
- `listCompaniesAction({ search?, page?, pageSize? })` → `ActionResult<{ rows: CompanyListItem[]; total: number }>`
- `getCompanyAction(id)` → `ActionResult<Company>` (null → `NOT_FOUND`)
- `createCompanyAction(input: CompanyInput)` → `ActionResult<Company>` (CNPJ dup → `DUPLICATE`)
- `updateCompanyAction(id, input: CompanyInput)` → `ActionResult<Company>`
- `deleteCompanyAction(id)` → `ActionResult<{ id: string }>`
- `getCompanyDependentsAction(id)` → `ActionResult<{ workUnits; ges; jobRoles; employees }>` (aviso de cascata)

## Unidade de Obra — `actions/pgr/work-units.ts`
- `listWorkUnitsAction({ companyId?, search?, page?, pageSize? })` → `ActionResult<{ rows; total }>`
- `getWorkUnitAction(id)` / `createWorkUnitAction(input)` / `updateWorkUnitAction(id, input)` / `deleteWorkUnitAction(id)`
- `getWorkUnitDependentsAction(id)` → `ActionResult<{ ges: number }>`
- Suporte à UI "copiar endereço da empresa": a página lê o endereço da empresa selecionada
  (via `getCompanyAction`) e pré-preenche no cliente; habilitado só se a empresa tiver endereço.

## Função — `actions/pgr/job-roles.ts`
- `listJobRolesAction({ companyId?, search?, page?, pageSize? })` → `ActionResult<{ rows; total }>`
- `getJobRoleAction(id)` / `createJobRoleAction(input)` (título dup → `DUPLICATE`) / `updateJobRoleAction(id, input)` / `deleteJobRoleAction(id)`
- `getJobRoleDependentsAction(id)` → `ActionResult<{ gesLinks; employees }>`

## GES + vínculos — `actions/pgr/ges.ts`
- `listGesAction({ companyId?, workUnitId?, search?, page?, pageSize? })` → `ActionResult<{ rows: GesListItem[]; total; totalWorkers }>`
- `getGesAction(id)` → `ActionResult<{ ges: Ges; exposedWorkers: number }>`
- `createGesAction(input)` / `updateGesAction(id, input)` / `deleteGesAction(id)`
- **Funções vinculadas (junção, sem CRUD standalone):**
  - `listGesJobRolesAction(gesId)` → `ActionResult<GesJobRoleItem[]>`
  - `listAvailableJobRolesAction(gesId)` → `ActionResult<JobRoleOption[]>` (não vinculadas)
  - `addGesJobRoleAction({ gesId, jobRoleId, workerCount, workSchedule? })` → `ActionResult<...>` (worker_count≤0 → `VALIDATION`; vínculo dup → `DUPLICATE`)
  - `updateGesJobRoleAction(id, { workerCount, workSchedule? })`
  - `removeGesJobRoleAction(id)`
- Após add/update/remove de vínculo, `exposedWorkers` reflete a nova soma (derivado).

## Funcionário — `actions/pgr/employees.ts`
- `listEmployeesAction({ companyId?, status?, search?, page?, pageSize? })` → `ActionResult<{ rows: EmployeeListItem[]; total }>`
- `getEmployeeAction(id)` → `ActionResult<Employee>` (null → `NOT_FOUND`)
- `createEmployeeAction(input)` (CPF inválido → `VALIDATION`; CPF dup → `DUPLICATE`) / `updateEmployeeAction(id, input)` / `deleteEmployeeAction(id)`
- `listGesFunctionsAction(gesId)` → `ActionResult<JobRoleOption[]>` (picker de Função: só as do GES)

## Garantias verificáveis (ligadas aos FRs/SCs)
- Detalhe/edição/exclusão de id de outro tenant → `NOT_FOUND` (FR-003, SC-006).
- Papel `client` → `FORBIDDEN` em qualquer action (FR-065, SC-008).
- Listas paginadas; navegação preserva filtros (FR-006, SC-009).
- Nº de expostos sempre derivado e somente leitura (FR-041, SC-003).
- Picker de Função do funcionário = só funções do GES (FR-053, SC-004).
