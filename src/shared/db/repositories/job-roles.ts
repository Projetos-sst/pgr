import "server-only";

import { eq } from "drizzle-orm";

import { withOrg } from "../with-org";
import { jobRoles, type JobRole } from "../schema/job-roles";
import { auditedTenantWrite } from "./audited-write";

export type NewJobRoleInput = {
  companyId: string;
  title: string;
  cbo?: string | null;
  workSchedule?: string | null;
  description?: string | null;
};

export async function listJobRoles(orgId: string): Promise<JobRole[]> {
  return withOrg(orgId, (tx) =>
    tx.select().from(jobRoles).where(eq(jobRoles.orgId, orgId)),
  );
}

export async function createJobRole(
  orgId: string,
  input: NewJobRoleInput,
): Promise<JobRole> {
  return auditedTenantWrite(orgId, "pgr.job_roles.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(jobRoles)
        .values({ ...input, orgId })
        .returning();
      return row;
    }),
  );
}
