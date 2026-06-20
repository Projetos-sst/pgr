import "server-only";

import { eq } from "drizzle-orm";

import { withOrg } from "../with-org";
import { workUnits, type WorkUnit } from "../schema/work-units";
import { auditedTenantWrite } from "./audited-write";

export type NewWorkUnitInput = {
  companyId: string;
  name: string;
  description: string;
  contractNumber?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

export async function listWorkUnits(orgId: string): Promise<WorkUnit[]> {
  return withOrg(orgId, (tx) =>
    tx.select().from(workUnits).where(eq(workUnits.orgId, orgId)),
  );
}

export async function createWorkUnit(
  orgId: string,
  input: NewWorkUnitInput,
): Promise<WorkUnit> {
  return auditedTenantWrite(orgId, "pgr.work_units.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(workUnits)
        .values({ ...input, orgId })
        .returning();
      return row;
    }),
  );
}
