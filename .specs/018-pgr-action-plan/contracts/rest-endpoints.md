# Contract — REST Medidas de Controle

Arquivos NOVOS: `src/app/api/v1/risks/[id]/control-measures/route.ts` (coleção aninhada) e
`src/app/api/v1/control-measures/[id]/route.ts` (item flat). Todos via `restHandler` (auth real ou
bypass dev; mapeia código→HTTP; 201/204). Cada handler declara `export const runtime = "nodejs";` e
`export const dynamic = "force-dynamic";`. O REST **espelha** as Server Actions (mesmo repo, mesma
validação, mesmo `toActionError`); **não** chamam `revalidatePath`.

## Endpoints

| Método · Rota | Ação | Sucesso |
| --- | --- | --- |
| `GET /api/v1/risks/{id}/control-measures` | list do risco (paginado `page`/`pageSize`) | 200 `{ rows, total }` |
| `POST /api/v1/risks/{id}/control-measures` | create (corpo completo; nível NR-01) | 201 `ControlMeasure` |
| `GET /api/v1/control-measures/{id}` | getById | 200 `ControlMeasure` |
| `PUT /api/v1/control-measures/{id}` | update (corpo completo; `control_level` imutável) | 200 `ControlMeasure` |
| `DELETE /api/v1/control-measures/{id}` | delete físico | 204 (sem corpo) |

**Sem** endpoint de dependentes (sem FK de entrada). `{id}` na rota aninhada = **riskId**; na flat
= **measureId**.

## `src/app/api/v1/risks/[id]/control-measures/route.ts`

```ts
import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import { controlMeasureInputSchema } from "@/shared/domains/pgr/control-measure";
import * as repo from "@/shared/db/repositories/control-measures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: riskId } = await params;
    return repo.listControlMeasures(tenantId, riskId, pageParamsFrom(req));
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id: riskId } = await params;
      const values = controlMeasureInputSchema.parse(await req.json());
      return repo.createControlMeasure(tenantId, riskId, values);
    },
    { status: 201 },
  );
}
```

## `src/app/api/v1/control-measures/[id]/route.ts`

```ts
import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { controlMeasureInputSchema } from "@/shared/domains/pgr/control-measure";
import * as repo from "@/shared/db/repositories/control-measures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getControlMeasureById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const values = controlMeasureInputSchema.parse(await req.json());
    const row = await repo.updateControlMeasure(tenantId, id, values);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deleteControlMeasure(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
```

## Contratos de payload

### Query params (`GET .../control-measures`)

`page?` (int ≥1), `pageSize?` (int, default 20, máx 100). Escopo = medidas do `riskId` da rota.

### Body create (`POST`) / update (`PUT`) — `ControlMeasureInput`

```json
{
  "controlLevel": "collective_protection",
  "applicable": true,
  "justification": "Ruído acima do NA em fonte fixa",
  "monitoring": "Dosimetria semestral",
  "actionWhat": "Instalar enclausuramento acústico na prensa",
  "actionHow": "Projeto acústico + execução por fornecedor homologado",
  "actionTracking": "Checklist mensal de manutenção do enclausuramento",
  "actionMeasurement": "Nova dosimetria pós-instalação (< 85 dB(A))",
  "actionResponsible": "Maria Souza (Eng. Segurança)",
  "actionDeadline": "2026-09-30"
}
```

- `controlLevel` ∈ {`elimination`,`collective_protection`,`administrative`,`ppe`} — obrigatório no
  **POST**; no **PUT** o corpo é completo mas `control_level` é **ignorado** na escrita (imutável).
- `applicable` boolean. **Se `true`** ⇒ `actionWhat` e `actionHow` obrigatórios; senão opcionais.
- Demais campos opcionais (`""`/omitido → `null`). `actionDeadline` = `AAAA-MM-DD` opcional.
- **Não** enviar `id`, `riskId`, `orgId` — `riskId` vem da rota; `orgId` vem da sessão. Campos
  extras são ignorados.

### Respostas

- 200 (list/get/update), 201 (create) → JSON (`ControlMeasure`). 204 (delete) → sem corpo.
- Erro → `{ "error": { "code": "...", "message": "...", "fields"?: {...} } }`.

## Mapeamento código → HTTP (via `HTTP_BY_CODE` em `src/shared/api/rest.ts`)

| Situação | Código | HTTP |
| --- | --- | --- |
| enum/condicional (actionWhat/How) inválidos | `VALIDATION` | **422** |
| `riskId` inexistente/cross-tenant (list/create) | `FK_NOT_FOUND` | **422** |
| medida inexistente/cross-tenant (get/put/delete) | `NOT_FOUND` | **404** |
| **`control_level` duplicado no risco** (create) | `DUPLICATE` | **409** |
| papel `client` | `FORBIDDEN` | **403** |
| sem tenant | `NO_TENANT_CONTEXT` | **403** |

> `DUPLICATE`/409 vem **automaticamente** do SQLSTATE 23505 da UNIQUE
> `uq_control_measures_org_risk_level` (mapeado por `toActionError`) — o handler não trata
> explicitamente.

## Auth (herdada de `restHandler`)

- Produção: `requireOfficeStaff()` (sessão Clerk).
- Dev/homolog: bypass com `APP_ENV != "production"` + `DEV_API_AUTH_BYPASS=true` e headers
  `x-dev-tenant`/`x-dev-role`/`x-dev-user`. Usado nos testes REST e no cURL manual.

## Limitação conhecida (harness REST-via-Jest)

REST-via-Jest pode falhar com 500 (pré-existente; provado em fatias 014/016). Se ocorrer,
documentar e validar o REST **autoritativamente por cURL** contra o dev server no Postgres efêmero
(ver `quickstart.md`). As Server Actions (mesmo repo/validação/mapeamento) + isolamento provam a
lógica.
