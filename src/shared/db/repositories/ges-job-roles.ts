import "server-only";

import { eq } from "drizzle-orm";

import { workerCountSchema } from "@/shared/domains/pgr/validation";

import { withOrg } from "../with-org";
import { gesJobRoles, type GesJobRole } from "../schema/ges-job-roles";
import { auditedTenantWrite } from "./audited-write";

export type NewGesJobRoleInput = {
  gesId: string;
  jobRoleId: string;
  workerCount: number;
  workSchedule?: string | null;
};

export async function listGesJobRoles(orgId: string): Promise<GesJobRole[]> {
  return withOrg(orgId, (tx) =>
    tx.select().from(gesJobRoles).where(eq(gesJobRoles.orgId, orgId)),
  );
}

export async function createGesJobRole(
  orgId: string,
  input: NewGesJobRoleInput,
): Promise<GesJobRole> {
  const workerCount = workerCountSchema.parse(input.workerCount);
  return auditedTenantWrite(orgId, "pgr.ges_job_roles.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(gesJobRoles)
        .values({
          orgId,
          gesId: input.gesId,
          jobRoleId: input.jobRoleId,
          workerCount,
          workSchedule: input.workSchedule ?? null,
        })
        .returning();
      return row;
    }),
  );
}
