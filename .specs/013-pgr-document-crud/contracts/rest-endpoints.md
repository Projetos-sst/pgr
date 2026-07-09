# Contract — REST `/api/v1/pgr`

Arquivos NOVOS: `src/app/api/v1/pgr/route.ts` e `src/app/api/v1/pgr/[id]/route.ts`. Espelham
`api/v1/companies/**`. Todos via `restHandler` (auth real ou bypass dev; mapeia código→HTTP; 201/204).
Cada handler declara `export const runtime = "nodejs";` e `export const dynamic = "force-dynamic";`.

## Endpoints

| Método · Rota             | Ação                                                                         | Sucesso               |
| ------------------------- | ---------------------------------------------------------------------------- | --------------------- |
| `GET /api/v1/pgr`         | list (paginado, filtros `companyId`/`workUnitId`/`search`/`page`/`pageSize`) | 200 `{ rows, total }` |
| `POST /api/v1/pgr`        | create (exige `declarationAccepted: true`)                                   | 201 `Pgr`             |
| `GET /api/v1/pgr/{id}`    | getById                                                                      | 200 `Pgr`             |
| `PUT /api/v1/pgr/{id}`    | update (corpo completo, sem aceite)                                          | 200 `Pgr`             |
| `DELETE /api/v1/pgr/{id}` | delete                                                                       | 204 (sem corpo)       |

**Sem** `GET /api/v1/pgr/{id}/dependents` (fora de escopo). **Sem** 409.

## `src/app/api/v1/pgr/route.ts`

```ts
import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { pgrCreateSchema } from "@/shared/domains/pgr/pgr";
import * as repo from "@/shared/db/repositories/pgr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return restHandler(req, ({ tenantId }) =>
    repo.listPgr(tenantId, {
      ...pageParamsFrom(req),
      companyId: req.nextUrl.searchParams.get("companyId") ?? undefined,
      workUnitId: req.nextUrl.searchParams.get("workUnitId") ?? undefined,
    }),
  );
}

export function POST(req: NextRequest) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const parsed = pgrCreateSchema.parse(await req.json());
      const { declarationAccepted: _accepted, ...values } = parsed; // NÃO persistido
      return repo.createPgr(tenantId, values);
    },
    { status: 201 },
  );
}
```

## `src/app/api/v1/pgr/[id]/route.ts`

```ts
import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { pgrInputSchema } from "@/shared/domains/pgr/pgr";
import * as repo from "@/shared/db/repositories/pgr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getPgrById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const values = pgrInputSchema.parse(await req.json());
    const row = await repo.updatePgr(tenantId, id, values);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deletePgr(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
```

## Contratos de payload

### Query params (`GET /api/v1/pgr`)

`search?` (string), `page?` (int ≥1), `pageSize?` (int, default 20, máx 100), `companyId?` (uuid),
`workUnitId?` (uuid). Params desconhecidos ignorados.

### Body create (`POST`) — `PgrCreateInput`

```json
{
  "companyId": "<uuid da empresa do tenant>",
  "workUnitId": "<uuid da obra da empresa | omitir/''>",
  "responsible": "Eng. Fulano",
  "registrationType": "crea",
  "registrationNumber": "SP-123456",
  "issuedAt": "2026-01-10",
  "validUntil": "2027-01-10",
  "declarationAccepted": true
}
```

`declarationAccepted` DEVE ser `true` (senão 422 `VALIDATION`); **não é persistido**.

### Body update (`PUT`) — `PgrInput` (corpo completo, sem `declarationAccepted`)

```json
{
  "companyId": "<uuid>",
  "workUnitId": "<uuid | ''>",
  "responsible": "Eng. Fulano",
  "registrationType": "not_applicable",
  "registrationNumber": "",
  "issuedAt": "2026-01-10",
  "validUntil": "2027-06-10"
}
```

### Respostas

- 200 (list/get/update), 201 (create) → JSON. 204 (delete) → sem corpo.
- Erro → `{ "error": { "code": "...", "message": "...", "fields"?: {...} } }`.

## Mapeamento código → HTTP (via `HTTP_BY_CODE` em `src/shared/api/rest.ts`)

| Situação                                                                | Código              | HTTP                |
| ----------------------------------------------------------------------- | ------------------- | ------------------- |
| aceite ausente / validade < emissão / tipo↔número / uuid inválido       | `VALIDATION`        | **422**             |
| empresa/obra inválida, obra de outra empresa, empresa/obra cross-tenant | `FK_NOT_FOUND`      | **422**             |
| pgr inexistente / cross-tenant (get/put/delete)                         | `NOT_FOUND`         | **404**             |
| papel `client`                                                          | `FORBIDDEN`         | **403**             |
| sem tenant                                                              | `NO_TENANT_CONTEXT` | **403**             |
| (não aplicável)                                                         | `DUPLICATE`         | ~~409~~ — **nunca** |

> Nota: `VALIDATION` mapeia para **422** neste projeto (não 400). O prompt cita "400" como faixa de
> validação; o comportamento real e coerente com os demais recursos é **422**. Os testes asseveram 422.

## Auth (herdada de `restHandler`)

- Produção: `requireOfficeStaff()` (sessão Clerk).
- Dev/homolog: bypass com `APP_ENV != "production"` + `DEV_API_AUTH_BYPASS=true` e headers
  `x-dev-tenant`/`x-dev-role`/`x-dev-user`. Usado nos testes REST e no cURL manual.
