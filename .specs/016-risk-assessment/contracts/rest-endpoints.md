# Contract — REST Avaliações de Risco

Arquivos NOVOS: `src/app/api/v1/risks/[id]/assessments/route.ts` (coleção aninhada) e
`src/app/api/v1/risk-assessments/[id]/route.ts` (item flat). Todos via `restHandler` (auth real ou
bypass dev; mapeia código→HTTP; 201/204). Cada handler declara `export const runtime = "nodejs";` e
`export const dynamic = "force-dynamic";`. O REST **espelha** as Server Actions: lê a metodologia via
`getRiskMethodologyView` e deriva `riskLevel`/`result` com `deriveAssessmentResult` **antes** de
persistir (mesma regra, sem re-implementar). REST handlers **não** chamam `revalidatePath`.

## Endpoints

| Método · Rota                          | Ação                                                | Sucesso               |
| -------------------------------------- | --------------------------------------------------- | --------------------- |
| `GET /api/v1/risks/{id}/assessments`   | list do risco (paginado: `page`/`pageSize`)         | 200 `{ rows, total }` |
| `POST /api/v1/risks/{id}/assessments`  | create (corpo completo; calcula riskLevel+result)   | 201 `RiskAssessment`  |
| `GET /api/v1/risk-assessments/{id}`    | getById                                             | 200 `RiskAssessment`  |
| `PUT /api/v1/risk-assessments/{id}`    | update (corpo completo; recalcula riskLevel+result) | 200 `RiskAssessment`  |
| `DELETE /api/v1/risk-assessments/{id}` | delete físico                                       | 204 (sem corpo)       |

**Sem** endpoint de dependentes. **Sem** 409. `{id}` na rota aninhada = **riskId**; na flat =
**assessmentId**.

## `src/app/api/v1/risks/[id]/assessments/route.ts`

```ts
import type { NextRequest } from "next/server";
import { restHandler, pageParamsFrom } from "@/shared/api/rest";
import {
  riskAssessmentInputSchema,
  deriveAssessmentResult,
} from "@/shared/domains/pgr/risk-assessment";
import * as repo from "@/shared/db/repositories/risk-assessments";
import { getRiskMethodologyView } from "@/shared/db/repositories/risk-methodology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id: riskId } = await params;
    return repo.listRiskAssessments(tenantId, riskId, pageParamsFrom(req));
  });
}

export function POST(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id: riskId } = await params;
      const values = riskAssessmentInputSchema.parse(await req.json());
      const { classificationBands } = await getRiskMethodologyView(tenantId);
      const derived = deriveAssessmentResult(values, classificationBands);
      return repo.createRiskAssessment(tenantId, riskId, { ...values, ...derived });
    },
    { status: 201 },
  );
}
```

## `src/app/api/v1/risk-assessments/[id]/route.ts`

```ts
import type { NextRequest } from "next/server";
import { restHandler } from "@/shared/api/rest";
import { NotFoundError } from "@/shared/errors/not-found-error";
import {
  riskAssessmentInputSchema,
  deriveAssessmentResult,
} from "@/shared/domains/pgr/risk-assessment";
import * as repo from "@/shared/db/repositories/risk-assessments";
import { getRiskMethodologyView } from "@/shared/db/repositories/risk-methodology";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const row = await repo.getRiskAssessmentById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return restHandler(req, async ({ tenantId }) => {
    const { id } = await params;
    const values = riskAssessmentInputSchema.parse(await req.json());
    const { classificationBands } = await getRiskMethodologyView(tenantId);
    const derived = deriveAssessmentResult(values, classificationBands);
    const row = await repo.updateRiskAssessment(tenantId, id, { ...values, ...derived });
    if (!row) throw new NotFoundError();
    return row;
  });
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return restHandler(
    req,
    async ({ tenantId }) => {
      const { id } = await params;
      const deleted = await repo.deleteRiskAssessment(tenantId, id);
      if (!deleted) throw new NotFoundError();
    },
    { status: 204 },
  );
}
```

## Contratos de payload

### Query params (`GET .../assessments`)

`page?` (int ≥1), `pageSize?` (int, default 20, máx 100). Params desconhecidos ignorados. Escopo =
avaliações do `riskId` da rota.

### Body create (`POST`) / update (`PUT`) — `RiskAssessmentInput` (mesmo corpo completo)

```json
{
  "criterion": "quantitative",
  "probability": 3,
  "severity": 3,
  "uncertaintyDegree": 0,
  "toleranceLimit": "85 dB(A) / NEN 8h",
  "assessedAt": "2026-07-08"
}
```

- `criterion` (obrigatório) ∈ {`qualitative`,`quantitative`}; `probability`/`severity` inteiros 1–5;
  `uncertaintyDegree` inteiro 0–2 (default 0); `assessedAt` `AAAA-MM-DD` obrigatória; `toleranceLimit`
  opcional (`""`/omitido → `undefined`).
- **Não** enviar `riskLevel`, `result`, `riskId`, `orgId` — `riskLevel`/`result` são calculados no
  servidor; `riskId` vem da rota; `orgId` vem da sessão. Campos extras são ignorados pelo schema.

### Respostas

- 200 (list/get/update), 201 (create) → JSON (`RiskAssessment`, com `riskLevel`/`result` já
  persistidos). 204 (delete) → sem corpo.
- Erro → `{ "error": { "code": "...", "message": "...", "fields"?: {...} } }`.

## Mapeamento código → HTTP (via `HTTP_BY_CODE` em `src/shared/api/rest.ts`)

| Situação                                              | Código              | HTTP                |
| ----------------------------------------------------- | ------------------- | ------------------- |
| criterion/prob/sev/uncertainty/assessedAt inválidos   | `VALIDATION`        | **422**             |
| `riskId` inexistente / cross-tenant (list/create)     | `FK_NOT_FOUND`      | **422**             |
| avaliação inexistente / cross-tenant (get/put/delete) | `NOT_FOUND`         | **404**             |
| papel `client`                                        | `FORBIDDEN`         | **403**             |
| sem tenant                                            | `NO_TENANT_CONTEXT` | **403**             |
| (não aplicável — sem UNIQUE)                          | `DUPLICATE`         | ~~409~~ — **nunca** |

> `VALIDATION` mapeia para **422** neste projeto (não 400), coerente com os demais recursos. Os
> testes asseveram 422.

## Auth (herdada de `restHandler`)

- Produção: `requireOfficeStaff()` (sessão Clerk).
- Dev/homolog: bypass com `APP_ENV != "production"` + `DEV_API_AUTH_BYPASS=true` e headers
  `x-dev-tenant`/`x-dev-role`/`x-dev-user`. Usado nos testes REST e no cURL manual.

## Limitação conhecida (harness REST-via-Jest)

REST-via-Jest pode falhar com 500 (pré-existente; provado com `rest-pgr.test.ts` na fatia `014`).
Se ocorrer, documentar e validar o REST **autoritativamente por cURL** contra o dev server no
Postgres efêmero (ver `quickstart.md`). As Server Actions (mesmo repo/validação/mapeamento) +
isolamento provam a lógica.
