# Contract — Server Actions `control-measures`

Arquivo NOVO: `src/shared/server/actions/pgr/control-measures.ts`. `"use server"`. Espelha
`actions/pgr/risk-assessments.ts`. Toda action via `officeAction(operation, fn, {audit?})` →
`ActionResult<T>` (gate `requireOfficeStaff` + mapeamento de erro + auditoria). **Não** importa
Drizzle. Valida com `controlMeasureInputSchema` **antes** do repositório.

## Imports-chave

```ts
"use server";
import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  controlMeasureInputSchema,
  type ControlMeasureInput,
  type ControlMeasureListItem,
} from "@/shared/domains/pgr/control-measure";
import * as repo from "@/shared/db/repositories/control-measures";
import type { ControlMeasure } from "@/shared/db/schema/risks";
```

## Helpers de path

```ts
const basePath = (riskId: string) => `/risks/${riskId}/control-measures`;
function revalidateMeasure(riskId: string, measureId?: string) {
  revalidatePath(`/risks/${riskId}`);
  revalidatePath(basePath(riskId));
  revalidatePath(`${basePath(riskId)}/new`);
  if (measureId) revalidatePath(`${basePath(riskId)}/${measureId}/edit`);
}
```

## Assinaturas

| Action                                          | Operação                      | Audit | Retorno                                                      |
| ----------------------------------------------- | ----------------------------- | ----- | ------------------------------------------------------------ |
| `listControlMeasuresAction(riskId, params?)`    | `pgr.control_measures.list`   | não   | `ActionResult<Paginated<ControlMeasureListItem>>`            |
| `getControlMeasureAction(id)`                   | `pgr.control_measures.get`    | não   | `ActionResult<ControlMeasure>` (null → 404)                  |
| `createControlMeasureAction(riskId, input)`     | `pgr.control_measures.create` | sim   | `ActionResult<ControlMeasure>` (DUPLICATE se nível repetido) |
| `updateControlMeasureAction(riskId, id, input)` | `pgr.control_measures.update` | sim   | `ActionResult<ControlMeasure>` (null → 404)                  |
| `deleteControlMeasureAction(riskId, id)`        | `pgr.control_measures.delete` | sim   | `ActionResult<{ id: string }>`                               |

> `update`/`delete` recebem `riskId` **apenas** para `revalidatePath` das rotas aninhadas (a
> escrita/exclusão em si é por `id` da medida).

## Esboços

```ts
export async function listControlMeasuresAction(
  riskId: string,
  params: repo.ListControlMeasuresParams = {},
): Promise<ActionResult<Paginated<ControlMeasureListItem>>> {
  return officeAction("pgr.control_measures.list", ({ tenantId }) =>
    repo.listControlMeasures(tenantId, riskId, params),
  );
}

export async function getControlMeasureAction(
  id: string,
): Promise<ActionResult<ControlMeasure>> {
  return officeAction("pgr.control_measures.get", async ({ tenantId }) => {
    const row = await repo.getControlMeasureById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function createControlMeasureAction(
  riskId: string,
  input: ControlMeasureInput,
): Promise<ActionResult<ControlMeasure>> {
  return officeAction(
    "pgr.control_measures.create",
    async ({ tenantId }) => {
      const values = controlMeasureInputSchema.parse(input);
      const row = await repo.createControlMeasure(tenantId, riskId, values);
      revalidateMeasure(riskId);
      return row;
    },
    { audit: true },
  );
}

export async function updateControlMeasureAction(
  riskId: string,
  id: string,
  input: ControlMeasureInput,
): Promise<ActionResult<ControlMeasure>> {
  return officeAction(
    "pgr.control_measures.update",
    async ({ tenantId }) => {
      const values = controlMeasureInputSchema.parse(input);
      const row = await repo.updateControlMeasure(tenantId, id, values);
      if (!row) throw new NotFoundError();
      revalidateMeasure(riskId, id);
      return row;
    },
    { audit: true },
  );
}

export async function deleteControlMeasureAction(
  riskId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.control_measures.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteControlMeasure(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidateMeasure(riskId);
      return { id };
    },
    { audit: true },
  );
}
```

## Contexto (read-only) — **reuso**, sem action nova obrigatória

O contexto do risco e a avaliação vigente são carregados nas **páginas** (Server Components) por
actions **já existentes**, evitando uma action redundante:

- `getRiskAction(riskId)` → `ActionResult<Risk>` (agente/perigo/descrição/fontes/lesões/…).
- `getCurrentRiskAssessmentAction(riskId)` → `ActionResult<RiskAssessment | null>` (`riskLevel`,
  `result`; `null` → "Sem avaliação vigente").
- `listEmployeesAction()` → `ActionResult<Paginated<EmployeeListItem>>` (sugestões de responsável;
  grava `fullName` como texto).

> **Opcional** `getControlMeasureContextAction(riskId)`: um agregador que devolve
> `{ risk, currentAssessment }` numa chamada — criar **apenas** se reduzir round-trips na UI; não é
> obrigatório e não persiste nada.

## Erros (via `toActionError` / `officeAction`)

| Situação                                              | Código              | HTTP (na superfície REST) |
| ----------------------------------------------------- | ------------------- | ------------------------- |
| ranges/enum/condicional (actionWhat/How) inválidos    | `VALIDATION`        | 422                       |
| `riskId` inexistente/cross-tenant (create/list)       | `FK_NOT_FOUND`      | 422                       |
| medida inexistente/cross-tenant (get/update/delete)   | `NOT_FOUND`         | 404                       |
| **nível `control_level` duplicado no risco** (create) | `DUPLICATE`         | **409**                   |
| papel `client`                                        | `FORBIDDEN`         | 403                       |
| sem tenant                                            | `NO_TENANT_CONTEXT` | 403                       |

Nunca aceitar `orgId`/`organizationId`/`organization_id` do cliente — o tenant vem de
`officeAction` (`{ tenantId }`).
