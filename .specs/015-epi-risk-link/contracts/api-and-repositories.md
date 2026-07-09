# Phase 1 — Contracts: API, Server Actions e repositório

> Regra das 4 partes do repo (CLAUDE.md): uma CRUD só está "pronta" com \*\*Server Action + REST mirror
>
> - docs + Postman** no mesmo PR. Códigos de erro são do **contrato de domínio\*\*, não HTTP cru.

## Códigos de erro (contrato de domínio → HTTP)

| Código         | HTTP | Quando                                                                  |
| -------------- | ---- | ----------------------------------------------------------------------- |
| `VALIDATION`   | 422  | Zod falha (ex.: neutralização ausente/ inválida, uuid malformado)       |
| `DUPLICATE`    | 409  | Par `(org, catalog_id, risk_id)` repetido (unique 23505)                |
| `FK_NOT_FOUND` | 422  | Risco ou EPI inexistente / de outro tenant na criação (23503 ou assert) |
| `NOT_FOUND`    | 404  | Vínculo inexistente / cross-tenant em update/delete                     |
| `FORBIDDEN`    | 403  | Papel `client` (só `owner`/`collaborator` passam `requireOfficeStaff`)  |

## Repositório — `src/shared/db/repositories/epi-risk.ts`

Todas as funções via `withOrg(orgId, …)`; escritas via `auditedTenantWrite`
(`AUDIT_OP = "pgr.epi_risk.write_rejected"`).

- `listRiskEpis(orgId, { riskId }): Promise<EpiRiskLinkItem[]>` — `innerJoin epi_catalog` para trazer
  `name` + `ca` + `neutralization` dos vínculos do risco.
- `listAvailableEpisForRisk(orgId, riskId, { search? }): Promise<EpiOption[]>` — catálogo do tenant
  filtrado por `type = 'epi'`, **menos** os já vinculados àquele risco (`notInArray` por subquery),
  com busca `ilike` por nome/CA.
- `createRiskEpi(orgId, input): Promise<EpiRisk>` — **asserta que risco e catálogo pertencem ao
  tenant** (`assertRiskInTenant` / `assertCatalogInTenant` — **barreira real de isolamento**, já que a
  FK não passa pela RLS) → insere; duplicado → `DUPLICATE`.
- `updateRiskEpiNeutralization(orgId, id, { neutralization }): Promise<EpiRisk | null>` — `null` ⇒ `NOT_FOUND`.
- `deleteRiskEpi(orgId, id): Promise<boolean>` — `false` ⇒ `NOT_FOUND`.

## Server Actions — `src/shared/server/actions/pgr/epi-risk.ts`

Cinco actions via `officeAction(...)` → `ActionResult<T>`; `{ audit: true }` nas escritas;
`revalidatePath(\`/risks/${riskId}/edit\`)` após mutação.

| Action                           | Entrada                                 | Saída               |
| -------------------------------- | --------------------------------------- | ------------------- |
| `listRiskEpisAction`             | `riskId`                                | `EpiRiskLinkItem[]` |
| `listAvailableEpisForRiskAction` | `riskId` (+ `search?`)                  | `EpiOption[]`       |
| `addRiskEpiAction`               | `{ riskId, catalogId, neutralization }` | `EpiRisk`           |
| `updateRiskEpiAction`            | `id, riskId, { neutralization }`        | `EpiRisk`           |
| `removeRiskEpiAction`            | `id, riskId`                            | `void`              |

## REST mirror — `src/app/api/v1/risks/[id]/epis/**` (via `restHandler`)

Reusa o **mesmo** repositório, schema Zod e `toActionError` — nunca reimplementa a regra.

| Método & rota                                        | Ação                                           | Sucesso |
| ---------------------------------------------------- | ---------------------------------------------- | ------- |
| `GET /api/v1/risks/{id}/epis`                        | lista vinculados                               | 200     |
| `GET /api/v1/risks/{id}/epis?available=true&search=` | lista disponíveis (não vinculados) por nome/CA | 200     |
| `POST /api/v1/risks/{id}/epis`                       | cria vínculo (mescla `riskId` do path)         | **201** |
| `PUT /api/v1/risks/{id}/epis/{linkId}`               | altera neutralização                           | 200     |
| `DELETE /api/v1/risks/{id}/epis/{linkId}`            | remove vínculo                                 | **204** |

Arquivos: `src/app/api/v1/risks/[id]/epis/route.ts` (GET+POST) e
`src/app/api/v1/risks/[id]/epis/[linkId]/route.ts` (PUT+DELETE).

## Docs & Postman (partes 3 e 4 da regra)

- `docs/api/api-design.md` — recurso `/risks/{id}/epis` nas tabelas "Recursos" e "Sumário".
- `docs/api/sst-manager.postman_collection.json` — pasta "EPI x risco (vinculo)"
  (GET / GET available / POST / PUT / DELETE) + variável `epiCatalogId`, reusando `baseUrl`/`devTenant`/`devRole`.

## UI — `src/app/(protected)/risks/[id]/_components/epi-risco-section.tsx`

Client component autocontido (padrão `ManageFunctions`), montado como irmão após `<RiskForm>` na
página de **edição** (`risks/[id]/edit/page.tsx`), recebendo `riskId`:

- `reload()` busca vinculados + disponíveis em paralelo no mount e após cada mutação (`startTransition`).
- Tabela **Nome · CA · Neutraliza os Riscos? (select por linha) · Remover** + linha de adicionar
  (select de EPI disponível + select de neutralização). Sem polling; recarrega após cada ação.
