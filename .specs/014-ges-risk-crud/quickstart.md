# Quickstart / Test Plan — CRUD de Risco do GES

Roteiro de validação da fatia: testes automatizados (unit + integração em Postgres efêmero), teste
manual obrigatório (Playwright MCP + cURL) e quality gates. Comandos reais do `package.json`.

## Pré-requisitos de ambiente (integração)

Integração exige **Postgres efêmero** (não SQLite — a fatia depende de RLS). Variáveis:

- `INTEGRATION_DATABASE_URL` — conexão admin/owner (aplica migrations + seed; bypassa RLS).
- `INTEGRATION_DATABASE_URL_ADMIN` — opcional; se ausente, usa a de cima.
- `INTEGRATION_APP_RUNTIME_URL` — conexão do papel `app_runtime` (RLS real; mockada em
  `getDatabaseUrl`).

Sem essas variáveis, as suítes de integração fazem `describe.skip` (por design; CI sem DB fica
verde). `applyMigrations` aplica `0000`→`0012` (inclui `risks`); `seedPgrBase` semeia org_a/org_b com
`risks` já presente (`PGR_IDS.riskA=…d1`, `riskB=…e1`). **Banco descartável apenas** — nunca rodar
seed destrutivo (`truncate … cascade`) contra Supabase compartilhado.

## 1. Testes unitários — `src/__tests__/unit/domains/pgr/risk.test.ts` (NOVO)

Modelo: `unit/domains/pgr/companies.test.ts`/`pgr.test.ts` (usa `.parse()` + `.toThrow()`).

Casos:

- **create/update válido** → `riskInputSchema.parse({ gesId, agentType:"physical", description:"…" })`
  resolve; opcionais omitidos ficam `undefined`.
- **`gesId` inválido** → `gesId:"x"` → throw (campo `gesId`).
- **`agentType` ausente/enum inválido** → throw (campo `agentType`).
- **`description` ausente/vazia** → throw (campo `description`).
- **`qualitative_na` com concentração** → `measurementUnit:"qualitative_na",
  concentrationIntensity:"5"` → throw (campo `concentrationIntensity`).
- **unidade ausente com concentração** → `concentrationIntensity:"5"` sem `measurementUnit` → throw.
- **unidade quantitativa com concentração** → `measurementUnit:"db_a",
  concentrationIntensity:"87.5"` → resolve.
- **concentração ausente** → sem `concentrationIntensity` (mesmo com `qualitative_na`) → resolve.
- **concentração não-decimal** → `concentrationIntensity:"abc"` (com unidade quantitativa) → throw.
- **enum de tempo/unidade vazio** → `exposureTime:""`/`measurementUnit:""` → `undefined` (opcional).

Rodar: `npm run test` (ou `npx jest --selectProjects unit -t "risk"`).

## 2. Integração — Server Actions — `src/__tests__/integration/risks/risks.test.ts` (NOVO)

Modelo: `integration/pgr/pgr.test.ts`. Mocks no topo:

```ts
jest.mock("@/shared/db/env", () => ({
  getDatabaseUrl: () => process.env.INTEGRATION_APP_RUNTIME_URL,
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-office-staff", () => ({ requireOfficeStaff: jest.fn() }));
```

`shouldRun`, `asOwner(tenantId)`, `beforeAll: applyMigrations(admin)`, `beforeEach: seedPgrBase(admin)`.
**Rodar com `--runInBand`** (suítes compartilham uma DB; evita colisão de `truncate`/seed).

Casos (agindo como `org_a`, salvo indicação):

- **list** → só riscos do tenant; `total === 1` (linha seed `riskA`); linha inclui `gesName === "GES A"`.
- **getById** (`PGR_IDS.riskA`) → ok, `gesId === PGR_IDS.gesA`.
- **create** válido (`gesA`, `agentType`, `description`) → ok; aparece na lista.
- **create** com unidade quantitativa + concentração → ok.
- **create** `qualitative_na` + concentração → `{ ok:false, error.code:"VALIDATION" }`,
  `fields.concentrationIntensity`.
- **create** sem `agentType`/`description` → `VALIDATION`.
- **update** (`riskA`, corpo completo) → ok; alteração refletida em `getById`.
- **delete** (`riskA`) → ok; `getById` seguinte → `NOT_FOUND` (cascateia assessment/measure do seed).
- **`gesId` inválido** (uuid aleatório) no create → `FK_NOT_FOUND`.
- **`gesId` cross-tenant** (`gesB` agindo como `org_a`) no create → `FK_NOT_FOUND`.
- **cross-tenant get/update/delete** (`PGR_IDS.riskB` agindo como `org_a`) → `NOT_FOUND` (3 casos).
- **outro tenant não aparece na lista** → agindo como `org_a`, lista não contém `riskB`.
- **papel client** → `mockedGate.mockRejectedValue(new ForbiddenError())` → `FORBIDDEN`.

## 3. Integração — REST — `src/__tests__/integration/risks/rest-risks.test.ts` (NOVO)

Modelo: `integration/pgr/rest-pgr.test.ts`. `beforeAll`: `APP_ENV="local"`,
`DEV_API_AUTH_BYPASS="true"`. Helper `req({method, body, role, tenant, query})` com headers
`x-dev-tenant`/`x-dev-role`. Handlers de rota dinâmica recebem `{ params: Promise.resolve({ id }) }`.

Casos (asserção de `res.status` e `body.error.code`):

- `GET` list → 200; `body.total === 1`.
- `POST` create válido → 201.
- `POST` sem `description`/`agentType` → 422 `VALIDATION`.
- `POST` `qualitative_na` + concentração → 422 `VALIDATION`.
- `POST` `gesId` inválido/cross-tenant → 422 `FK_NOT_FOUND`.
- `GET /{id}` (`riskA`) → 200; `GET /{id}` (`riskB`, tenant org_a) → 404.
- `PUT /{id}` (`riskA`, corpo completo) → 200; `PUT` de `riskB` → 404.
- `DELETE /{id}` (`riskA`) → 204; `DELETE` de `riskB` → 404.
- `role:"client"` em qualquer método → 403.
- **nunca 409** (nenhum caso de duplicidade).

> Nota (herdada da 013): se o harness REST-via-jest tiver problema de ambiente pré-existente (as
> suítes `rest-*` compartilham a mesma limitação), validar o REST via cURL contra o dev server
> (seção 7b) e registrar o resultado. Isso **não** é bug da fatia.

## 4. Integração — Isolamento RLS — `src/__tests__/integration/risks/risks-isolation.test.ts` (NOVO)

```ts
import { runIsolationSuite } from "../_helpers/isolation-suite";
import { PGR_IDS } from "../_helpers/pgr-seed";

runIsolationSuite({
  table: "risks",
  seededCountA: 1,
  crossTenantInsertSql:
    `insert into public.risks (id, org_id, ges_id, agent_type, description) values ` +
    `('11111111-1111-1111-1111-1111111111f8','org_b','${PGR_IDS.gesB}','physical','x')`,
});
```

Prova: tenant A vê só A; B só B; query bare → 0; tenant inexistente → 0; INSERT cross-tenant
rejeitado pelo `WITH CHECK`; escopo não vaza após `withOrg`.

## 5. Nota sobre a seed compartilhada

`pgr-seed.ts` já cria `risks` (`id,org_id,ges_id,agent_type,description`) por tenant. Testes que
assertem campos opcionais (tempo/unidade/concentração) devem **criar via `createRiskAction`**
(preferido) para não alterar a seed compartilhada (usada por `pgr-*`/`pgr-risk-*`). Estender o insert
de `risks` na seed só se estritamente necessário — mantendo `PGR_IDS.riskA/riskB` e apenas
acrescentando colunas.

## 6. Docs/API + Postman (antes da PR)

- `docs/api/api-design.md`: adicionar linha na tabela de recursos REST
  (`| `/risks`·`/risks/{id}` | GET, POST · GET, PUT, DELETE |`), linha no sumário de actions
  (`| Riscos | actions/pgr/risks.ts | list, get, create, update, delete |`), seção
  `## Riscos — actions/pgr/risks.ts` (tabela de actions + bloco `RiskInput`/`RiskListItem`), e linha
  nas Rotas de UI (`/risks` · `/risks/new` · `/risks/[id]` · `/risks/[id]/edit`).
- `docs/api/sst-manager.postman_collection.json`: variável `{ "key": "riskId", "value": "" }` e pasta
  **"Riscos"** (5 requisições, espelhando "PGR"): GET list
  (`?companyId=&workUnitId=&gesId=&page=1&pageSize=20`), POST create (body completo), GET
  `/{{riskId}}`, PUT `/{{riskId}}` (corpo completo), DELETE `/{{riskId}}` — headers
  `x-dev-tenant`/`x-dev-role` (+ `Content-Type` nas escritas).

## 7. Teste manual obrigatório (antes da PR)

### 7a. UI — Playwright MCP

Servidor: `npm run dev` (com `.env.local` de dev; `DEV_API_AUTH_BYPASS` NÃO é necessário p/ UI, que
usa sessão). Passos:

1. Abrir `/risks` → validar **estado vazio** (orientação + botão "Novo") quando não há registros.
2. Clicar "Novo" → selecionar **Empresa → Obra → GES** (cascata; GES obrigatório), grupo do agente
   (obrigatório), descrição (obrigatória) e demais campos.
3. Preencher **concentração** com `measurementUnit = "Não aplicável / qualitativo"` → erro de
   validação; trocar para unidade quantitativa (ex.: dB(A)) → aceita.
4. Criar → risco aparece na lista.
5. Validar **filtro Empresa → Obra → GES**: selecionar empresa reduz obras; selecionar obra reduz
   GES; trocar empresa reseta obra e GES; trocar obra reseta GES.
6. Abrir **detalhe** → conferir campos read-only com labels pt-BR dos enums.
7. **Reutilizar** (no detalhe/linha) → abre `/risks/new?from=<id>` pré-preenchido; escolher **outro
   GES** de destino → criar → novo risco (novo id); o de origem permanece.
8. **Editar** → alterar descrição/tempo de exposição → salvar → refletido.
9. **Excluir** com confirmação → sai da lista.
10. Validar mensagens de erro (obrigatórios; regra de concentração) e navegação (Novo/voltar/nav
    "Riscos").

### 7b. REST — cURL (bypass dev)

Servidor com `APP_ENV != production` e `DEV_API_AUTH_BYPASS=true`. Use `-d @arquivo.json` (evita
corrupção de aspas no PowerShell). Substituir `<tenant>` por um `orgs.id` real de teste e `<ges>` por
um GES desse tenant.

```bash
BASE=http://localhost:3000/api/v1/risks
H=(-H "x-dev-tenant: <tenant>" -H "x-dev-role: owner")

# list
curl -s "${H[@]}" "$BASE?page=1&pageSize=20"
# create (body em create.json: gesId=<ges>, agentType, description) -> 201
curl -s -X POST "${H[@]}" -H "Content-Type: application/json" -d @create.json "$BASE"
# get
curl -s "${H[@]}" "$BASE/<id>"
# update (body completo em update.json) -> 200
curl -s -X PUT "${H[@]}" -H "Content-Type: application/json" -d @update.json "$BASE/<id>"
# delete -> 204
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "${H[@]}" "$BASE/<id>"
```

Validar: 200/201/204 no caminho feliz; **422** (sem `agentType`/`description`; concentração com
`qualitative_na`; `gesId` inválido/cross-tenant); **404** (id inexistente/cross-tenant); **403**
(`x-dev-role: client`); **nunca 409**.

> Dica de harness (Windows/Git Bash): ao extrair o `id` do JSON de create para os passos seguintes,
> faça-o **no mesmo shell** (grep/sed) para evitar divergência de caminho `/tmp` entre Git Bash e
> Node no Windows (aprendizado da fatia 013).

## 8. Quality gates (antes de commit/PR)

```bash
npm run format:check     # Prettier (rodar `npm run format` para aplicar nos arquivos tocados)
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # unit
npm run test:integration # integração (Postgres efêmero INTEGRATION_*) — usar --runInBand
npm run build            # opcional — sanity de build Next
```

**Nenhum commit/PR antes de**: testes automatizados verdes + teste manual (UI + cURL) concluído +
`docs/api/api-design.md` e Postman atualizados. `npm run check` roda
`format:check → lint → typecheck → test` (unit); a integração roda à parte (`test:integration`).
