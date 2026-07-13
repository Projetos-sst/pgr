import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type {
  PgrRevisionListItem,
  PgrRevisionValues,
} from "@/shared/domains/pgr/pgr-revision";

import { withOrg } from "../with-org";
import { pgrRevisions, type PgrRevision } from "../schema/pgr";
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

/**
 * Cria uma revisão (append-only). Número repetido no PGR → DUPLICATE (unique
 * `(org_id, pgr_id, revision_number)`). **Sem autor** (o ator fica no audit log).
 */
export async function createPgrRevision(
  orgId: string,
  pgrId: string,
  values: PgrRevisionValues,
): Promise<PgrRevision> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(pgrRevisions)
        .values({
          orgId,
          pgrId,
          revisionNumber: values.revisionNumber,
          revisedAt: values.revisedAt,
          notes: values.notes ?? null,
        })
        .returning();
      return row;
    }),
  );
}
