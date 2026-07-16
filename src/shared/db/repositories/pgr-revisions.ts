import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type {
  PgrRevisionListItem,
  PgrRevisionValues,
} from "@/shared/domains/pgr/pgr-revision";
import { NotFoundError } from "@/shared/errors/not-found-error";

import { withOrg } from "../with-org";
import { pgr, pgrRevisions, type PgrRevision } from "../schema/pgr";
import { auditedTenantWrite } from "./audited-write";

const AUDIT_OP = "pgr.pgr_revisions.write_rejected";

/** Revisões do PGR (número/data/notas), ordenadas por número desc. */
export async function listPgrRevisions(
  orgId: string,
  pgrId: string,
): Promise<PgrRevisionListItem[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select({
        id: pgrRevisions.id,
        revisionNumber: pgrRevisions.revisionNumber,
        revisedAt: pgrRevisions.revisedAt,
        notes: pgrRevisions.notes,
        createdAt: pgrRevisions.createdAt,
      })
      .from(pgrRevisions)
      .where(and(eq(pgrRevisions.orgId, orgId), eq(pgrRevisions.pgrId, pgrId)))
      .orderBy(desc(pgrRevisions.revisionNumber)),
  );
}

/** Maior número de revisão do PGR no tenant (ou `null` se não houver revisão). */
export async function getLatestRevisionNumber(
  orgId: string,
  pgrId: string,
): Promise<number | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ max: sql<number | null>`max(${pgrRevisions.revisionNumber})` })
      .from(pgrRevisions)
      .where(and(eq(pgrRevisions.orgId, orgId), eq(pgrRevisions.pgrId, pgrId)));
    return row?.max ?? null;
  });
}

/**
 * Cria uma revisão (append-only) com o **número calculado no servidor**. O input NÃO traz
 * `revisionNumber` — ele é `MAX+1` sob lock da linha-pai do PGR (`SELECT … FOR UPDATE`), que
 * serializa criações concorrentes do MESMO PGR (espelha `lockStockRow` em stock-movements) e
 * também valida existência/tenant (sem linha → `NotFoundError`/404). A UNIQUE
 * `(org_id, pgr_id, revision_number)` permanece como **backstop defensivo** (colisão
 * inesperada → `DUPLICATE`/409). Sem retry. **Sem autor** (o ator fica no audit log).
 */
export async function createPgrRevision(
  orgId: string,
  pgrId: string,
  values: PgrRevisionValues,
): Promise<PgrRevision> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      // 1) trava a linha-pai → serializa concorrentes do MESMO pgr; guard de tenant.
      const [parent] = await tx
        .select({ id: pgr.id })
        .from(pgr)
        .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
        .for("update")
        .limit(1);
      if (!parent) throw new NotFoundError();

      // 2) próximo número (idioma de agregado escalar da casa).
      const [{ next }] = await tx
        .select({
          next: sql<number>`coalesce(max(${pgrRevisions.revisionNumber}), 0)::int + 1`,
        })
        .from(pgrRevisions)
        .where(and(eq(pgrRevisions.orgId, orgId), eq(pgrRevisions.pgrId, pgrId)));

      // 3) insert; UNIQUE é o backstop.
      const [row] = await tx
        .insert(pgrRevisions)
        .values({
          orgId,
          pgrId,
          revisionNumber: next,
          revisedAt: values.revisedAt,
          notes: values.notes ?? null,
        })
        .returning();
      return row;
    }),
  );
}
