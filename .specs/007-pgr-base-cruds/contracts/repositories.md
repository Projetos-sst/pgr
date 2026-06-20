# Contrato — Repositórios (extensões da 006)

`src/shared/db/repositories/*`, `"server-only"`. Toda função recebe `tenantId` (sessão), roda em
`withOrg(tenantId, …)`, e filtra explicitamente por `org_id` (RLS é backstop, não substitui o
filtro). Escritas envolvidas por `auditedTenantWrite(tenantId, "<evento>", fn)`. Tipos de linha
inferidos do Drizzle (`Company`, `WorkUnit`, `JobRole`, `Ges`, `GesJobRole`, `Employee`).

## Convenções
- **Paginação**: `Paginated<T> = { rows: T[]; total: number }`; entrada `{ page = 1; pageSize = 20 }`.
  `limit = pageSize`, `offset = (page-1)*pageSize`; `total` via `count(*)` no mesmo filtro.
- **getById**: retorna `T | null` (id ausente no tenant → `null` → `NOT_FOUND` na action).
- **update**: retorna `T | null` (null se não encontrado no tenant).
- **delete**: retorna `boolean` (linhas afetadas > 0). Cascata/SET NULL pelo banco (006).
- **Inputs**: tipos `*Input` com todos os campos editáveis da 006 (não só um subconjunto).

## Empresa — `companies.ts`
```
listCompanies(tenantId, { search?, page?, pageSize? }) : Paginated<CompanyListItem>
getCompanyById(tenantId, id) : Company | null
createCompany(tenantId, input: CompanyInput) : Company        // input ESTENDIDO (todos os campos 006)
updateCompany(tenantId, id, input: CompanyInput) : Company | null
deleteCompany(tenantId, id) : boolean
countCompanyDependents(tenantId, id) : { workUnits; ges; jobRoles; employees }
```
`CompanyInput`: `cnpj?, razaoSocial, nomeFantasia?, phone?, email?, cnae?, mainActivity?,
riskGrade, logoPath?, zipCode?, street?, number?, complement?, district?, city?, state?`.

## Unidade de Obra — `work-units.ts`
```
listWorkUnits(tenantId, { companyId?, search?, page?, pageSize? }) : Paginated<WorkUnit>
getWorkUnitById(tenantId, id) : WorkUnit | null
createWorkUnit(tenantId, input: WorkUnitInput) : WorkUnit
updateWorkUnit(tenantId, id, input: WorkUnitInput) : WorkUnit | null
deleteWorkUnit(tenantId, id) : boolean
countWorkUnitDependents(tenantId, id) : { ges }
```

## Função — `job-roles.ts`
```
listJobRoles(tenantId, { companyId?, search?, page?, pageSize? }) : Paginated<JobRole>
getJobRoleById(tenantId, id) : JobRole | null
createJobRole(tenantId, input: JobRoleInput) : JobRole
updateJobRole(tenantId, id, input: JobRoleInput) : JobRole | null
deleteJobRole(tenantId, id) : boolean
countJobRoleDependents(tenantId, id) : { gesLinks; employees }
```

## GES — `ges.ts`
```
listGes(tenantId, { companyId?, workUnitId?, search?, page?, pageSize? })
    : Paginated<GesListItem> & { totalWorkers: number }     // totalWorkers derivado no escopo filtrado
getGesById(tenantId, id) : Ges | null
updateGes(tenantId, id, input: GesInput) : Ges | null
deleteGes(tenantId, id) : boolean
countExposedWorkersByGes(tenantId, gesId) : number          // REUSO
exposedWorkersByGesMap(tenantId) : Record<string, number>   // REUSO
```

## Vínculo GES↔Função — `ges-job-roles.ts`
```
listGesJobRoles(tenantId, { gesId }) : GesJobRoleItem[]                 // join job_roles p/ título
listAvailableJobRolesForGes(tenantId, gesId, companyId) : JobRoleOption[]  // funções da empresa NÃO vinculadas
createGesJobRole(tenantId, input) : GesJobRole                          // REUSO (valida worker_count)
updateGesJobRole(tenantId, id, { workerCount, workSchedule? }) : GesJobRole | null
deleteGesJobRole(tenantId, id) : boolean
```

## Funcionário — `employees.ts`
```
listEmployees(tenantId, { companyId?, status?, search?, page?, pageSize? }) : Paginated<EmployeeListItem>
getEmployeeById(tenantId, id) : Employee | null
createEmployee(tenantId, input: EmployeeInput) : Employee              // REUSO/estende (valida cpf/enums)
updateEmployee(tenantId, id, input: EmployeeInput) : Employee | null
deleteEmployee(tenantId, id) : boolean
```

## Isolamento (invariantes para os testes)
- Toda query carrega `where org_id = tenantId` **e** roda sob `withOrg` (GUC + RLS).
- `getById`/`update`/`delete` de id de outro tenant → `null`/`false` (nunca dado alheio).
- `UNIQUE(org_id, cpf)` e `uq_companies_org_id_cnpj`: mesmo valor aceito em orgs distintas,
  bloqueado no mesmo (→ `DUPLICATE`).
