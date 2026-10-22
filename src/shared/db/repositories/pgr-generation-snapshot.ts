import "server-only";
import { withOrg } from "../with-org";
import { getPgrConsolidated } from "./pgr-consolidated";
import { getPgrDocxExtras } from "./pgr-docx-extras";
import { getRiskMethodologyView } from "./risk-methodology";
/** One repeatable-read, read-only transaction for all database facts in an export. */
export function getPgrGenerationSnapshot(orgId: string, pgrId: string) {
  return withOrg(
    orgId,
    async (tx) => {
      const consolidated = await getPgrConsolidated(orgId, pgrId, tx);
      if (!consolidated) return null;
      const extras = await getPgrDocxExtras(orgId, pgrId, tx);
      if (!extras) return null;
      const methodology = await getRiskMethodologyView(orgId, tx);
      return { consolidated, extras, methodology };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
