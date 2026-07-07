# Quickstart / Test Plan — CRUD do Documento PGR

Roteiro de validação da fatia: testes automatizados (unit + integração em Postgres efêmero),
teste manual obrigatório (Playwright MCP + cURL) e quality gates. Comandos reais do `package.json`.

## Pré-requisitos de ambiente (integração)

Integração exige **Postgres efêmero** (não SQLite — a fatia depende de RLS). Variáveis:

- `INTEGRATION_DATABASE_URL` — conexão admin/owner (aplica migrations + seed; bypassa RLS).
- `INTEGRATION_DATABASE_URL_ADMIN` — opcional; se ausente, usa a de cima.
- `INTEGRATION_APP_RUNTIME_URL` — conexão do papel `app_runtime` (RLS real; mockada em
  `getDatabaseUrl`).

Sem essas variáveis, as suítes de integração fazem `describe.skip` (comportamento por design; CI sem
DB permanece verde). `applyMigrations` aplica `0000`→`0012` (inclui `pgr`); `seedPgrBase` semeia
org_a/org_b com `pgr` já presente (`PGR_IDS.pgrA/pgrB`).

## 1. Testes unitários — `src/__tests__/unit/domains/pgr/pgr.test.ts` (NOVO)

Modelo: `unit/domains/pgr/companies.test.ts` (usa `.parse()` + `.toThrow()`).

Casos:
- **create válido** → `pgrCreateSchema.parse({...,declarationAccepted:true})` resolve; valores coeridos.
- **create sem aceite** → `declarationAccepted` ausente/`false` → `.toThrow()` (VALIDATION).
- **validade < emissão** → `validUntil:"2025-01-01", issuedAt:"2026-01-01"` → throw (campo `validUntil`).
- **número obrigatório p/ crm/crea/mte** → `registrationType:"crm"` sem `registrationNumber` → throw.
- **número não se aplica p/ not_applicable** → `registrationType:"not_applicable"` + número preenchido → throw.
- **update parcial válido** → `pgrInputSchema.parse` de corpo válido sem `declarationAccepted` resolve.
- **UUID inválido** → `companyId:"x"` → throw (campo `companyId`); `workUnitId:""` → `undefined` (opcional).
- **workUnit vazio** → `workUnitId:""` vira `undefined` (opcional); `responsible:""` → `undefined`.

Rodar: `npm run test` (ou `npx jest --selectProjects unit -t "pgr"`).

## 2. Integração — Server Actions — `src/__tests__/integration/pgr/pgr.test.ts` (NOVO)

Modelo: `integration/pgr/companies.test.ts`. Mocks no topo:
```ts
jest.mock("@/shared/db/env", () => ({ getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({ requireOfficeStaff: jest.fn() }));
```
`shouldRun`, `asOwner(tenantId)`, `beforeAll: applyMigrations(admin)`, `beforeEach: seedPgrBase(admin)`.

Casos (agindo como `org_a`, salvo indicação):
- **list** → só PGRs do tenant; `total === 1` (linha seed `pgrA`); linha inclui `companyName`.
- **getById** (`PGR_IDS.pgrA`) → ok, `companyId === PGR_IDS.companyA`.
- **create** válido (empresa `companyA`, obra `workUnitA`, `declarationAccepted:true`) → ok; aparece na lista.
- **create sem aceite** → `{ ok:false, error.code:"VALIDATION" }`, `fields.declarationAccepted`.
- **create com validade < emissão** → `VALIDATION` (`fields.validUntil`).
- **create crm sem número** → `VALIDATION` (`fields.registrationNumber`).
- **update** (`pgrA`) → ok; alteração refletida em `getById`.
- **delete** (`pgrA`) → ok; `getById` seguinte → `NOT_FOUND`.
- **empresa inválida** (uuid aleatório) no create → `FK_NOT_FOUND`.
- **obra inválida** (uuid aleatório) no create → `FK_NOT_FOUND`.
- **obra de outra empresa** (empresa `companyA` + `workUnitB`) → `FK_NOT_FOUND`.
- **cross-tenant get/update/delete** (`PGR_IDS.pgrB` agindo como `org_a`) → `NOT_FOUND` (3 casos).
- **empresa cross-tenant** (create com `companyB` agindo como `org_a`) → `FK_NOT_FOUND`.
- **outro tenant não aparece na lista** → agindo como `org_a`, lista não contém `pgrB`.
- **papel client** → `mockedGate.mockRejectedValue(new ForbiddenError())` → `FORBIDDEN`.

## 3. Integração — REST — `src/__tests__/integration/pgr/rest-pgr.test.ts` (NOVO)

Modelo: `integration/pgr/rest-companies.test.ts`. `beforeAll`: `APP_ENV="local"`,
`DEV_API_AUTH_BYPASS="true"`. Helper `req({method, body, role, tenant, query})` com headers
`x-dev-tenant`/`x-dev-role`. Handlers de rota dinâmica recebem `{ params: Promise.resolve({ id }) }`.

Casos (asserção de `res.status` e `body.error.code`):
- `GET` list → 200; `body.total === 1`.
- `POST` create válido (com `declarationAccepted:true`) → 201.
- `POST` sem aceite → 422 `VALIDATION`.
- `POST` validade < emissão → 422 `VALIDATION`.
- `POST` empresa inválida / obra de outra empresa → 422 `FK_NOT_FOUND`.
- `GET /{id}` (`pgrA`) → 200; `GET /{id}` (`pgrB`, tenant org_a) → 404.
- `PUT /{id}` (`pgrA`, corpo completo) → 200; `PUT` de `pgrB` → 404.
- `DELETE /{id}` (`pgrA`) → 204; `DELETE` de `pgrB` → 404.
- `role:"client"` em qualquer método → 403.
- **nunca 409** (nenhum caso de duplicidade).

## 4. Integração — Isolamento RLS — `src/__tests__/integration/pgr/pgr-isolation.test.ts` (NOVO)

```ts
import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "pgr",
  seededCountA: 1,
  crossTenantInsertSql:
    `insert into public.pgr (id, org_id, company_id, work_unit_id) values ` +
    `('11111111-1111-1111-1111-1111111111f9','org_b','${PGR_IDS.companyB}','${PGR_IDS.workUnitB}')`,
});
```
Prova: tenant A vê só A; B só B; query bare → 0; tenant inexistente → 0; INSERT cross-tenant rejeitado
pelo `WITH CHECK`; escopo não vaza após `withOrg`.

## 5. Nota sobre a seed compartilhada

`pgr-seed.ts` já cria `pgr` (`id,org_id,company_id,work_unit_id`) por tenant. Testes que assertem
`responsible`/`registrationType`/datas devem **criar via `createPgrAction`** (preferido) para não
alterar a seed compartilhada (que é usada por `pgr-risk-*`). Estender o insert de `pgr` na seed só se
estritamente necessário — mantendo `PGR_IDS.pgrA/pgrB` e apenas acrescentando colunas.

## 6. Docs/API + Postman (antes da PR)

- `docs/api/api-design.md`: adicionar linha na tabela de recursos REST
  (`| `/pgr` · `/pgr/{id}` | GET, POST · GET, PUT, DELETE |`), linha no sumário de actions
  (`| PGR | actions/pgr/pgr.ts | list, get, create, update, delete |`), seção
  `## PGR — actions/pgr/pgr.ts` (tabela de actions + bloco `PgrInput`/`PgrCreateInput`/`PgrListItem`),
  e linha nas Rotas de UI (`/pgr` · `/pgr/new` · `/pgr/[id]` · `/pgr/[id]/edit`).
- `docs/api/sst-manager.postman_collection.json`: variável `{ "key": "pgrId", "value": "" }` e pasta
  **"PGR"** (5 requisições, espelhando "Categoria"): GET list (`?companyId=&workUnitId=&page=1&pageSize=20`),
  POST create (body com `declarationAccepted:true`), GET `/{{pgrId}}`, PUT `/{{pgrId}}` (corpo completo,
  sem aceite), DELETE `/{{pgrId}}` — headers `x-dev-tenant`/`x-dev-role` (+ `Content-Type` nas escritas).

## 7. Teste manual obrigatório (antes da PR)

### 7a. UI — Playwright MCP
Servidor: `npm run dev` (com `.env.local` de dev; `DEV_API_AUTH_BYPASS` NÃO é necessário p/ UI, que
usa sessão). Passos:
1. Abrir `/pgr` → validar **estado vazio** (orientação + botão "Novo") quando não há registros.
2. Clicar "Novo" → preencher empresa (obrigatória), obra (opcional, filtrada pela empresa),
   responsável, tipo/número de registro, emissão e validade.
3. Tentar criar **sem aceitar** a Declaração → botão "Confirmar e prosseguir" desabilitado; se forçado,
   erro de validação do servidor.
4. Aceitar a Declaração (checkbox) → "Confirmar e prosseguir" → PGR criado; aparece na lista.
5. Validar **filtro Empresa → Obra**: selecionar empresa reduz as obras às daquela empresa; trocar
   empresa reseta a obra.
6. Abrir **detalhe** → conferir campos read-only; botão "Metodologia de Avaliação" é placeholder (#76).
7. **Editar** → alterar datas/responsável (sem novo gate de declaração) → salvar → refletido.
8. **Excluir** com confirmação → sai da lista.
9. Validar mensagens de erro (validade < emissão; número obrigatório por tipo) e navegação
   (Novo/voltar/nav "PGR").

### 7b. REST — cURL (bypass dev)
Servidor com `APP_ENV != production` e `DEV_API_AUTH_BYPASS=true`. Use `-d @arquivo.json` (evita
corrupção de aspas no PowerShell). Substituir `<tenant>` por um `orgs.id` real de teste.

```bash
BASE=http://localhost:3000/api/v1/pgr
H=(-H "x-dev-tenant: <tenant>" -H "x-dev-role: owner")

# list
curl -s "${H[@]}" "$BASE?page=1&pageSize=20"
# create (body em create.json com declarationAccepted:true) -> 201
curl -s -X POST "${H[@]}" -H "Content-Type: application/json" -d @create.json "$BASE"
# get
curl -s "${H[@]}" "$BASE/<id>"
# update (body completo em update.json, sem declarationAccepted) -> 200
curl -s -X PUT "${H[@]}" -H "Content-Type: application/json" -d @update.json "$BASE/<id>"
# delete -> 204
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "${H[@]}" "$BASE/<id>"
```
Validar: 200/201/204 no caminho feliz; **422** (sem aceite / validade<emissão / número-por-tipo /
empresa-obra inválida); **404** (id inexistente/cross-tenant); **403** (`x-dev-role: client`);
**nunca 409**.

## 8. Quality gates (antes de commit/PR)

```bash
npm run format:check     # Prettier (rodar `npm run format` para aplicar nos arquivos tocados)
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # unit
npm run test:integration # integração (Postgres efêmero INTEGRATION_*)
npm run build            # opcional — sanity de build Next
```

**Nenhum commit/PR antes de**: testes automatizados verdes + teste manual (UI + cURL) concluído +
`docs/api/api-design.md` e Postman atualizados. `npm run check` roda
`format:check → lint → typecheck → test` (unit); a integração roda à parte (`test:integration`).
