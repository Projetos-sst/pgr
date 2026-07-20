import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { PgrGesLinkItem } from "@/shared/domains/pgr/pgr-ges";
import { ReferenceNotFoundError } from "@/shared/errors/reference-not-found-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { pgrGes, type PgrGes } from "../schema/pgr";
import { ges } from "../schema/ges";
import { auditedTenantWrite } from "./audited-write";

const AUDIT_OP = "pgr.pgr_ges.write_rejected";

/** Garante que o GES existe DENTRO do tenant (senão FK_NOT_FOUND). */
async function assertGesInTenant(
  tx: TenantTransaction,
  orgId: string,
  gesId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: ges.id })
    .from(ges)
    .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
    .limit(1);
  if (!row) throw new ReferenceNotFoundError("ges");
}

/** GES vinculados ao PGR (id do vínculo + nome do GES), ordenados por nome. */
export async function listPgrGes(
  orgId: string,
  pgrId: string,
): Promise<PgrGesLinkItem[]> {
  return withOrg(orgId, (tx) =>
    tx
      .select({
        id: pgrGes.id,
        gesId: pgrGes.gesId,
        gesName: ges.name,
        createdAt: pgrGes.createdAt,
      })
      .from(pgrGes)
      .innerJoin(ges, and(eq(ges.id, pgrGes.gesId), eq(ges.orgId, orgId)))
      .where(and(eq(pgrGes.orgId, orgId), eq(pgrGes.pgrId, pgrId)))
      .orderBy(asc(ges.name)),
  );
}

/** Cria o vínculo. Par `(org, pgr, ges)` duplicado → DUPLICATE (unique). */
export async function addGesToPgr(
  orgId: string,
  pgrId: string,
  gesId: string,
): Promise<PgrGes> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      await assertGesInTenant(tx, orgId, gesId);
      const [row] = await tx.insert(pgrGes).values({ orgId, pgrId, gesId }).returning();
      return row;
    }),
  );
}

/** Remove (físico) apenas o vínculo — o GES e seus riscos permanecem. `false` ⇒ NOT_FOUND. */
export async function removeGesFromPgr(
  orgId: string,
  pgrId: string,
  gesId: string,
): Promise<boolean> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const rows = await tx
        .delete(pgrGes)
        .where(
          and(eq(pgrGes.orgId, orgId), eq(pgrGes.pgrId, pgrId), eq(pgrGes.gesId, gesId)),
        )
        .returning({ id: pgrGes.id });
      return rows.length > 0;
    }),
  );
}
