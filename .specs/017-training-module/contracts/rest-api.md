# Contracts — REST API (Módulo de Treinamentos)

Route Handlers sob `src/app/api/v1/**`, embrulhados por `restHandler(...)`, reutilizando o **mesmo**
repositório + Zod + `toActionError` das Server Actions (nunca reimplementar a regra). Mapeamento de erro
→ HTTP já existente: `VALIDATION`→422, `DUPLICATE`→409, `FK_NOT_FOUND`→422, `NOT_FOUND`→404,
`FORBIDDEN`→403, `UNAUTHORIZED`→401. `201` em create, `204` em delete. Autenticação via sessão
(`requireOfficeStaff`); em não-prod, bypass de dev (`DEV_API_AUTH_BYPASS` + headers `x-dev-*`).

## Recurso `training-catalog` (US1)

| Método   | Rota                                       | Corpo/Query                                                          | Resposta                                  |
| -------- | ------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------- |
| `GET`    | `/api/v1/training-catalog`                 | `?page&pageSize&search`                                              | `200 { rows, total }`                     |
| `POST`   | `/api/v1/training-catalog`                 | `{ name, referenceNorm?, workloadHours, periodicity, description? }` | `201 <item>` · `422`/`409`                |
| `GET`    | `/api/v1/training-catalog/[id]`            | —                                                                    | `200 <item>` · `404`                      |
| `PUT`    | `/api/v1/training-catalog/[id]`            | mesmo corpo do POST                                                  | `200 <item>` · `422`/`409`/`404`          |
| `DELETE` | `/api/v1/training-catalog/[id]`            | —                                                                    | `204` · `404` · bloqueio por dependências |
| `GET`    | `/api/v1/training-catalog/[id]/dependents` | —                                                                    | `200 { records, requiredLinks }` · `404`  |

## Recurso `training-records` (US2)

| Método   | Rota                            | Corpo/Query                                                 | Resposta                                                                                        |
| -------- | ------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/training-records`      | `?employeeId&page&pageSize`                                 | `200 { rows, total }`                                                                           |
| `POST`   | `/api/v1/training-records`      | `{ employeeId, trainingId, completedAt, certificatePath? }` | `201 <record>` (`valid_until` calculado no servidor) · `422` (data futura) · `422 FK_NOT_FOUND` |
| `GET`    | `/api/v1/training-records/[id]` | —                                                           | `200 <record>` · `404`                                                                          |
| `DELETE` | `/api/v1/training-records/[id]` | —                                                           | `204` · `404`                                                                                   |

## Recurso `job-role-required-trainings` (US4)

| Método   | Rota                                       | Corpo/Query                 | Resposta                                              |
| -------- | ------------------------------------------ | --------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/v1/job-role-required-trainings`      | `?jobRoleId`                | `200 [<links>]`                                       |
| `POST`   | `/api/v1/job-role-required-trainings`      | `{ jobRoleId, trainingId }` | `201 <link>` (idempotente) · `422`/`422 FK_NOT_FOUND` |
| `DELETE` | `/api/v1/job-role-required-trainings/[id]` | —                           | `204` · `404`                                         |

> Leituras de conformidade (US4) e de vencimento (US3) são consumidas por Server Component; registrar em
> `api-design.md`/Postman as listagens que tenham valor de API (ex.: vencimento por funcionário/janela,
> conformidade por funcionário). Sem novos verbos além dos acima.

## Documentação obrigatória (checklist de API do CLAUDE.md)

- `docs/api/api-design.md`: registrar os 3 recursos, verbos e filtros nas tabelas "Recursos" e "Sumário".
- `docs/api/sst-manager.postman_collection.json`: 1 pasta por recurso (`training-catalog`,
  `training-records`, `job-role-required-trainings`), espelhando as pastas existentes; reutilizar as
  Variables `baseUrl`/`devTenant`/`devRole`/ids.
