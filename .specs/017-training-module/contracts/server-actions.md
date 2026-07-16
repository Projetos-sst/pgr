# Contracts — Server Actions (Módulo de Treinamentos)

Todas as Server Actions são embrulhadas por `officeAction(operation, fn, { audit })` e retornam
`ActionResult<T>` (`{ ok: true, data } | { ok: false, error }`). Gate: `requireOfficeStaff()` (papéis
`owner`/`collaborator`; `client` → `FORBIDDEN`). `tenantId` vem do contexto, nunca do input. Escrita via
`auditedTenantWrite`. Arquivos: `src/shared/server/actions/pgr/{training-catalog,training-records,
job-role-required-trainings}.ts`.

## US1 — `training-catalog.ts`

| Action                               | Assinatura                                                                                    | Sucesso                                                            | Erros                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `listTrainingCatalogAction`          | `(params?: { page?; pageSize?; search? }) → ActionResult<Paginated<TrainingCatalogListItem>>` | `{rows,total}` do tenant; busca `ILIKE` em `name`/`reference_norm` | —                                                                                                                          |
| `getTrainingCatalogAction`           | `(id) → ActionResult<TrainingCatalog>`                                                        | 1 item do tenant                                                   | `NOT_FOUND` (inexistente/cross-tenant)                                                                                     |
| `createTrainingCatalogAction`        | `(input: TrainingCatalogInput) → ActionResult<TrainingCatalog>`                               | item criado (`org_id` da sessão)                                   | `VALIDATION` (zod: carga ≤0/não-inteira, periodicidade inválida, nome vazio); `DUPLICATE` (UNIQUE `org_id,name`)           |
| `updateTrainingCatalogAction`        | `(id, input) → ActionResult<TrainingCatalog>`                                                 | item atualizado                                                    | `VALIDATION`; `DUPLICATE`; `NOT_FOUND` cross-tenant                                                                        |
| `deleteTrainingCatalogAction`        | `(id) → ActionResult<{id}>`                                                                   | `{id}`                                                             | `NOT_FOUND` cross-tenant; bloqueio por dependências (RESTRICT → erro previsível; UI checa `dependents` antes — ver abaixo) |
| `getTrainingCatalogDependentsAction` | `(id) → ActionResult<TrainingCatalogDependents>`                                              | `{ records, requiredLinks }`                                       | `NOT_FOUND` cross-tenant                                                                                                   |

> A UI chama `getTrainingCatalogDependentsAction` antes de excluir; se houver dependências, avisa e
> bloqueia. A exclusão com dependências viola o RESTRICT no banco e é mapeada como erro previsível
> (não 500).

## US2 — `training-records.ts`

| Action                       | Assinatura                                                                                | Sucesso                                                                                                                 | Erros                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `listTrainingRecordsAction`  | `(params: { employeeId; page?; pageSize? }) → ActionResult<Paginated<TrainingRecordRow>>` | histórico do funcionário no tenant                                                                                      | `NOT_FOUND` (funcionário cross-tenant, se validado)                                                                |
| `getTrainingRecordAction`    | `(id) → ActionResult<TrainingRecord>`                                                     | 1 registro                                                                                                              | `NOT_FOUND` cross-tenant                                                                                           |
| `createTrainingRecordAction` | `(input: TrainingRecordInput) → ActionResult<TrainingRecord>`                             | registro gravado; `valid_until = computeValidUntil(completed_at, periodicity do catálogo)` no servidor; `single → null` | `VALIDATION` (`completed_at` futuro, campos); `FK_NOT_FOUND` (funcionário/treinamento de outro tenant → RLS barra) |
| `deleteTrainingRecordAction` | `(id) → ActionResult<{id}>`                                                               | `{id}`                                                                                                                  | `NOT_FOUND` cross-tenant                                                                                           |

## US3 — leitura (Server Component / actions de listagem)

Consumo por Server Component; expor action de listagem quando útil à UI. Sem escrita.

| Função                                                    | Assinatura                                 | Retorno                                                       |
| --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `listTrainingExpiryAction` (ou query de Server Component) | `(params: { employeeId?; dueWithinDays: 30 | 60                                                            | 90 }) → ActionResult<TrainingStatusRow[]>` | último registro por par (D5) classificado por D2 (`expired | due_soon | ok`); exclui `single` (`valid_until IS NULL`); escopado ao tenant |
| `getTrainingDueSummaryAction`                             | `() → ActionResult<TrainingDueSummary>`    | `{ expired, dueSoon }` (contagens do tenant) — dashboard (D7) |

## US4 — `job-role-required-trainings.ts` + conformidade

| Action                         | Assinatura                                                                   | Sucesso                                                                                                                                       | Erros                                                          |
| ------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `listRequiredTrainingsAction`  | `(params: { jobRoleId }) → ActionResult<RequiredTrainingRow[]>`              | vínculos da função no tenant                                                                                                                  | —                                                              |
| `addRequiredTrainingAction`    | `(input: { jobRoleId; trainingId }) → ActionResult<JobRoleRequiredTraining>` | vínculo criado; **idempotente** (UNIQUE `org_id,job_role_id,training_id`)                                                                     | `VALIDATION`; `FK_NOT_FOUND` (função/treinamento cross-tenant) |
| `removeRequiredTrainingAction` | `(id) → ActionResult<{id}>` (ou por par)                                     | `{id}`                                                                                                                                        | `NOT_FOUND` cross-tenant                                       |
| `getEmployeeComplianceAction`  | `(params: { employeeId }) → ActionResult<TrainingStatusRow[]>`               | para cada obrigatório da função do funcionário, status via D5+D2; sem registro → `missing`; sem função → lista vazia (conforme por vacuidade) | `NOT_FOUND` (funcionário cross-tenant)                         |
| `listNonComplianceAction`      | `() → ActionResult<TrainingStatusRow[]>`                                     | mesma regra sem filtro de funcionário; não-conforme = `missing`\|`expired`                                                                    | —                                                              |

## Regras transversais

- Toda action de escrita passa por `requireOfficeStaff()`; `client` → `FORBIDDEN`/403.
- Toda leitura/escrita dentro de `withOrg(tenantId, …)`; sem tenant → 0 linhas (RLS backstop).
- Zod valida antes de tocar o banco (Princípio V). `valid_until` nunca vem do cliente.
- `revalidatePath` nas telas afetadas após escrita (padrão companies).
