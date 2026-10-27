import "server-only";
import { withOrg } from "../with-org";
import { getPgrConsolidated } from "./pgr-consolidated";
import { getPgrDocxExtras } from "./pgr-docx-extras";
import { getRiskMethodologyView } from "./risk-methodology";
import { getDocumentApprovalTx } from "./pgr-document-approvals";
import { and, eq, sql } from "drizzle-orm";
import { pgr } from "../schema/pgr";
/** One repeatable-read, read-only transaction for all database facts in an export. */
export function getPgrGenerationSnapshot(orgId: string, pgrId: string, actor?: string) {
  return withOrg(
    orgId,
    async (tx) => {
      if (actor)
        await tx.execute(sql`select set_config('app.current_actor',${actor},true)`);
      const consolidated = await getPgrConsolidated(orgId, pgrId, tx);
      if (!consolidated) return null;
      const extras = await getPgrDocxExtras(orgId, pgrId, tx);
      if (!extras) return null;
      const methodology = await getRiskMethodologyView(orgId, tx);
      const approval = await getDocumentApprovalTx(tx, orgId, pgrId);
      const [head] = await tx
        .select({ required: pgr.technicalReviewRequired })
        .from(pgr)
        .where(and(eq(pgr.orgId, orgId), eq(pgr.id, pgrId)))
        .limit(1);
      return {
        consolidated,
        extras,
        methodology,
        approval: { ...approval, required: head?.required === true },
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
