# Contract — REST `/api/v1/risks`

Arquivos NOVOS: `src/app/api/v1/risks/route.ts` e `src/app/api/v1/risks/[id]/route.ts`. Espelham
`api/v1/pgr/**`. Todos via `restHandler` (auth real ou bypass dev; mapeia código→HTTP; 201/204).
Cada handler declara `export const runtime = "nodejs";` e `export const dynamic = "force-dynamic";`.

## Endpoints

| Método · Rota               | Ação                                                                                 | Sucesso               |
| --------------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| `GET /api/v1/risks`         | list (paginado, filtros `companyId`/`workUnitId`/`gesId`/`search`/`page`/`pageSize`) | 200 `{ rows, total }` |
| `POST /api/v1/risks`        | create (corpo completo)                                                              | 201 `Risk`            |
| `GET /api/v1/risks/{id}`    | getById                                                                              | 200 `Risk`            |
| `PUT /api/v1/risks/{id}`    | update (corpo completo)                                                              | 200 `Risk`            |
| `DELETE /api/v1/risks/{id}` | delete                                                                               | 204 (sem corpo)       |

**Sem** `GET /api/v1/risks/{id}/dependents` (fora de escopo). **Sem** 409.

## `src/app/api/v1/risks/route.ts`

```ts
import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { riskInputSchema } from "@/shared/domains/pgr/risk";
import * as repo from "@/shared/db/repositories/risks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listRisks(tenantId, {
      ...pageParamsFrom(req),
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
      workUnitId: req.nextUrl.searchParams.get("workUnitId") ?? undefined,
      gesId: req.nextUrl.searchParams.get("gesId") ?? undefined,
      search: req.nextUrl.searchParams.get("search") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const values = riskInputSchema.parse(await req.json());
      return repo.createRisk(tenantId, values);
    },
    { status: 201 },
  );
}
```

## `src/app/api/v1/risks/[id]/route.ts`

```ts
import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { riskInputSchema } from "@/shared/domains/pgr/risk";
import * as repo from "@/shared/db/repositories/risks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getRiskById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const values = riskInputSchema.parse(await req.json());
    const row = await repo.updateRisk(tenantId, id, values);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deleteRisk(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
```

## Contratos de payload

### Query params (`GET /api/v1/risks`)

`search?` (string, aplica em `description`), `page?` (int ≥1), `pageSize?` (int, default 20, máx
100), `companyId?` (uuid), `workUnitId?` (uuid), `gesId?` (uuid). Params desconhecidos ignorados.

### Body create (`POST`) / update (`PUT`) — `RiskInput` (mesmo corpo completo)

```json
{
  "gesId": "<uuid do GES do tenant>",
  "agentType": "physical",
  "hazard": "Ruído",
  "description": "Ruído contínuo acima de 85 dB(A)",
  "sources": "Compressores e britadeiras",
  "propagation": "Ar",
  "exposureTime": "gt_7h",
  "possibleInjuries": "Perda auditiva induzida por ruído",
  "noxiousAgentCode": "01.01.001",
  "measurementUnit": "db_a",
  "concentrationIntensity": "87.5"
}
```

- `gesId` obrigatório (uuid); `agentType` e `description` obrigatórios.
- Campos opcionais podem ser omitidos ou `""` (→ `undefined`).
- `concentrationIntensity` só é aceita com `measurementUnit` **quantitativa**; com `qualitative_na`
  (ou sem unidade) e concentração preenchida → 422 `VALIDATION`.

### Respostas

- 200 (list/get/update), 201 (create) → JSON. 204 (delete) → sem corpo.
- Erro → `{ "error": { "code": "...", "message": "...", "fields"?: {...} } }`.

## Mapeamento código → HTTP (via `HTTP_BY_CODE` em `src/shared/api/rest.ts`)

| Situação                                                                                              | Código              | HTTP                |
| ----------------------------------------------------------------------------------------------------- | ------------------- | ------------------- |
| gesId/agentType/description ausentes; enum inválido; regra `qualitative_na`; concentração não-decimal | `VALIDATION`        | **422**             |
| `gesId` inexistente / cross-tenant                                                                    | `FK_NOT_FOUND`      | **422**             |
| risco inexistente / cross-tenant (get/put/delete)                                                     | `NOT_FOUND`         | **404**             |
| papel `client`                                                                                        | `FORBIDDEN`         | **403**             |
| sem tenant                                                                                            | `NO_TENANT_CONTEXT` | **403**             |
| (não aplicável)                                                                                       | `DUPLICATE`         | ~~409~~ — **nunca** |

> Nota: `VALIDATION` mapeia para **422** neste projeto (não 400), coerente com os demais recursos.
> Os testes asseveram 422.

## Auth (herdada de `restHandler`)

- Produção: `requireOfficeStaff()` (sessão Clerk).
- Dev/homolog: bypass com `APP_ENV != "production"` + `DEV_API_AUTH_BYPASS=true` e headers
  `x-dev-tenant`/`x-dev-role`/`x-dev-user`. Usado nos testes REST e no cURL manual.
