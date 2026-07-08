# Contract — Server Actions `risk-assessments`

Arquivo NOVO: `src/shared/server/actions/pgr/risk-assessments.ts`. `"use server"`. Espelha
`actions/pgr/risks.ts`. Toda action via `officeAction(operation, fn, {audit?})` → `ActionResult<T>`
(gate `requireOfficeStaff` + mapeamento de erro + auditoria). **Não** importa Drizzle. Valida com
`riskAssessmentInputSchema` **antes** do repositório. Lê a metodologia via `getRiskMethodologyView`
(repo `risk-methodology`) e deriva `riskLevel`/`result` com `deriveAssessmentResult` (domínio, puro)
antes de persistir.

## Imports-chave

```ts
"use server";
import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";
import {
  riskAssessmentInputSchema,
  deriveAssessmentResult,
  type RiskAssessmentInput,
  type RiskAssessmentListItem,
} from "@/shared/domains/pgr/risk-assessment";
import * as repo from "@/shared/db/repositories/risk-assessments";
import { getRiskMethodologyView } from "@/shared/db/repositories/risk-methodology";
import type { RiskAssessment } from "@/shared/db/schema/risks";
```

## Assinaturas

| Action                                                     | Operação                       | Audit | Retorno                                       |
| ---------------------------------------------------------- | ------------------------------ | ----- | --------------------------------------------- |
| `listRiskAssessmentsAction(riskId, params?)`               | `pgr.risk_assessments.list`    | não   | `ActionResult<Paginated<RiskAssessmentListItem>>` |
| `getRiskAssessmentAction(id)`                              | `pgr.risk_assessments.get`     | não   | `ActionResult<RiskAssessment>` (null → 404)   |
| `getCurrentRiskAssessmentAction(riskId)`                   | `pgr.risk_assessments.current` | não   | `ActionResult<RiskAssessment \| null>`        |
| `createRiskAssessmentAction(riskId, input)`                | `pgr.risk_assessments.create`  | sim   | `ActionResult<RiskAssessment>`                |
| `updateRiskAssessmentAction(riskId, id, input)`            | `pgr.risk_assessments.update`  | sim   | `ActionResult<RiskAssessment>` (null → 404)   |
| `deleteRiskAssessmentAction(riskId, id)`                   | `pgr.risk_assessments.delete`  | sim   | `ActionResult<{ id: string }>`                |

> `updateRiskAssessmentAction`/`deleteRiskAssessmentAction` recebem `riskId` **apenas** para
> `revalidatePath` das rotas aninhadas (a escrita/exclusão em si é por `id` da avaliação).
> `getCurrentRiskAssessmentAction` devolve `null` (não erro) quando o risco não tem avaliações.

## Helpers de path

```ts
const basePath = (riskId: string) => `/risks/${riskId}/assessments`;
function revalidateAssessment(riskId: string, assessmentId?: string) {
  revalidatePath(`/risks/${riskId}`);
  revalidatePath(basePath(riskId));
  revalidatePath(`${basePath(riskId)}/new`);
  if (assessmentId) revalidatePath(`${basePath(riskId)}/${assessmentId}/edit`);
}
```

## Esboços (create/update — leitura de metodologia + derivação)

```ts
export async function listRiskAssessmentsAction(
  riskId: string,
  params: repo.ListRiskAssessmentsParams = {},
): Promise<ActionResult<Paginated<RiskAssessmentListItem>>> {
  return officeAction("pgr.risk_assessments.list", ({ tenantId }) =>
    repo.listRiskAssessments(tenantId, riskId, params),
  );
}

export async function getRiskAssessmentAction(id: string): Promise<ActionResult<RiskAssessment>> {
  return officeAction("pgr.risk_assessments.get", async ({ tenantId }) => {
    const row = await repo.getRiskAssessmentById(tenantId, id);
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function getCurrentRiskAssessmentAction(
  riskId: string,
): Promise<ActionResult<RiskAssessment | null>> {
  return officeAction("pgr.risk_assessments.current", ({ tenantId }) =>
    repo.getCurrentRiskAssessment(tenantId, riskId),
  );
}

export async function createRiskAssessmentAction(
  riskId: string,
  input: RiskAssessmentInput,
): Promise<ActionResult<RiskAssessment>> {
  return officeAction(
    "pgr.risk_assessments.create",
    async ({ tenantId }) => {
      const values = riskAssessmentInputSchema.parse(input);
      const { classificationBands } = await getRiskMethodologyView(tenantId);
      const derived = deriveAssessmentResult(values, classificationBands);
      const row = await repo.createRiskAssessment(tenantId, riskId, { ...values, ...derived });
      revalidateAssessment(riskId);
      return row;
    },
    { audit: true },
  );
}

export async function updateRiskAssessmentAction(
  riskId: string,
  id: string,
  input: RiskAssessmentInput,
): Promise<ActionResult<RiskAssessment>> {
  return officeAction(
    "pgr.risk_assessments.update",
    async ({ tenantId }) => {
      const values = riskAssessmentInputSchema.parse(input);
      const { classificationBands } = await getRiskMethodologyView(tenantId);
      const derived = deriveAssessmentResult(values, classificationBands);
      const row = await repo.updateRiskAssessment(tenantId, id, { ...values, ...derived });
      if (!row) throw new NotFoundError();
      revalidateAssessment(riskId, id);
      return row;
    },
    { audit: true },
  );
}

export async function deleteRiskAssessmentAction(
  riskId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return officeAction(
    "pgr.risk_assessments.delete",
    async ({ tenantId }) => {
      const deleted = await repo.deleteRiskAssessment(tenantId, id);
      if (!deleted) throw new NotFoundError();
      revalidateAssessment(riskId);
      return { id };
    },
    { audit: true },
  );
}
```

## Erros (via `toActionError` / `officeAction`)

| Situação                                                   | Código              | HTTP (na superfície REST) |
| ---------------------------------------------------------- | ------------------- | ------------------------- |
| ranges (prob/sev/uncertainty), criterion, assessedAt      | `VALIDATION`        | 422                       |
| `riskId` inexistente/cross-tenant (create/list/current)   | `FK_NOT_FOUND`      | 422                       |
| avaliação inexistente/cross-tenant (get/update/delete)    | `NOT_FOUND`         | 404                       |
| papel `client`                                             | `FORBIDDEN`         | 403                       |
| sem tenant                                                 | `NO_TENANT_CONTEXT` | 403                       |
| (nunca)                                                    | `DUPLICATE`         | ~~409~~                   |
