# Contract — Server Actions (pgr-ges, pgr-revisions, pgr-consolidated)

Arquivos NOVOS. `"use server"`. Espelham `actions/pgr/epi-risk.ts` (associação) e o padrão de leitura
`officeAction`. Toda action via `officeAction(operation, fn, {audit?})` → `ActionResult<T>` (gate
`requireOfficeStaff` + mapeamento de erro + auditoria). **Não** importam Drizzle. Validam com Zod
**antes** do repositório.

## Imports-chave

```ts
"use server";
import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import { getPgrById } from "@/shared/db/repositories/pgr"; // valida PGR-alvo → 404
import * as gesLink from "@/shared/db/repositories/pgr-ges";
import * as revisions from "@/shared/db/repositories/pgr-revisions";
import * as consolidated from "@/shared/db/repositories/pgr-consolidated";
import { pgrGesInputSchema, type PgrGesInput } from "@/shared/domains/pgr/pgr-ges";
import {
  pgrRevisionInputSchema,
  type PgrRevisionInput,
} from "@/shared/domains/pgr/pgr-revision";
```

`const editPath = (pgrId) => \`/pgr/${pgrId}\`;` (revalida o editor com abas).

## `actions/pgr/pgr-ges.ts`

| Action                                 | Operação             | Audit | Retorno                          |
| -------------------------------------- | -------------------- | ----- | -------------------------------- |
| `listPgrGesAction(pgrId)`              | `pgr.pgr_ges.list`   | não   | `ActionResult<PgrGesLinkItem[]>` |
| `addGesToPgrAction(pgrId, input)`      | `pgr.pgr_ges.add`    | sim   | `ActionResult<{ pgrId, gesId }>` |
| `removeGesFromPgrAction(pgrId, gesId)` | `pgr.pgr_ges.remove` | sim   | `ActionResult<{ gesId }>`        |

```ts
export async function listPgrGesAction(pgrId): Promise<ActionResult<PgrGesLinkItem[]>> {
  return officeAction("pgr.pgr_ges.list", async ({ tenantId }) => {
    if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError(); // PGR-alvo → 404
    return gesLink.listPgrGes(tenantId, pgrId);
  });
}

export async function addGesToPgrAction(pgrId, input: PgrGesInput) {
  return officeAction(
    "pgr.pgr_ges.add",
    async ({ tenantId }) => {
      if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError();
      const { gesId } = pgrGesInputSchema.parse(input);
      await gesLink.addGesToPgr(tenantId, pgrId, gesId); // gesId inválido → FK_NOT_FOUND; dup → DUPLICATE
      revalidatePath(editPath(pgrId));
      return { pgrId, gesId };
    },
    { audit: true },
  );
}

export async function removeGesFromPgrAction(pgrId, gesId) {
  return officeAction(
    "pgr.pgr_ges.remove",
    async ({ tenantId }) => {
      const deleted = await gesLink.removeGesFromPgr(tenantId, pgrId, gesId);
      if (!deleted) throw new NotFoundError();
      revalidatePath(editPath(pgrId));
      return { gesId };
    },
    { audit: true },
  );
}
```

## `actions/pgr/pgr-revisions.ts`

| Action                                  | Operação                   | Audit | Retorno                               |
| --------------------------------------- | -------------------------- | ----- | ------------------------------------- |
| `listPgrRevisionsAction(pgrId)`         | `pgr.pgr_revisions.list`   | não   | `ActionResult<PgrRevisionListItem[]>` |
| `createPgrRevisionAction(pgrId, input)` | `pgr.pgr_revisions.create` | sim   | `ActionResult<PgrRevision>`           |

```ts
export async function createPgrRevisionAction(pgrId, input: PgrRevisionInput) {
  return officeAction(
    "pgr.pgr_revisions.create",
    async ({ tenantId }) => {
      if (!(await getPgrById(tenantId, pgrId))) throw new NotFoundError(); // PGR-alvo → 404
      const values = pgrRevisionInputSchema.parse(input);
      const row = await revisions.createPgrRevision(tenantId, pgrId, values); // nº repetido → DUPLICATE
      revalidatePath(editPath(pgrId));
      return row;
    },
    { audit: true },
  );
}
```

`listPgrRevisionsAction` valida PGR (`getPgrById` → 404) e devolve `listPgrRevisions`.

## `actions/pgr/pgr-consolidated.ts`

| Action                            | Operação                   | Audit | Retorno                                      |
| --------------------------------- | -------------------------- | ----- | -------------------------------------------- |
| `getPgrConsolidatedAction(pgrId)` | `pgr.pgr_consolidated.get` | não   | `ActionResult<PgrConsolidated>` (null → 404) |

```ts
export async function getPgrConsolidatedAction(
  pgrId,
): Promise<ActionResult<PgrConsolidated>> {
  return officeAction("pgr.pgr_consolidated.get", async ({ tenantId }) => {
    const data = await consolidated.getPgrConsolidated(tenantId, pgrId);
    if (!data) throw new NotFoundError();
    return data;
  });
}
```

## Erros (via `toActionError` / `officeAction`)

| Situação                                       | Código         | HTTP |
| ---------------------------------------------- | -------------- | ---- |
| PGR inexistente/cross-tenant (todas)           | `NOT_FOUND`    | 404  |
| GES inexistente/cross-tenant (add)             | `FK_NOT_FOUND` | 422  |
| vínculo GES duplicado (add)                    | `DUPLICATE`    | 409  |
| revisão de número duplicado (create)           | `DUPLICATE`    | 409  |
| `revisionNumber`/`revisedAt`/`gesId` inválidos | `VALIDATION`   | 422  |
| papel `client` (write)                         | `FORBIDDEN`    | 403  |

> **Decisão (research D3)**: o `ReferenceNotFoundError("pgr")` do repo não é usado nas actions — o
> PGR-alvo é validado por `getPgrById(...) → NotFoundError` (404). Só o **GES** vira
> `FK_NOT_FOUND`. Nunca aceitar `orgId`/`organizationId`/`organization_id` do cliente (o tenant vem
> de `officeAction`).
