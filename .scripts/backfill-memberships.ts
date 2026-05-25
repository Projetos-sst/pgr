import * as dotenv from "dotenv";
import { clerkClient } from "@clerk/nextjs/server";

import { upsertUser } from "@/lib/db/repositories/users";
import { upsertOrg } from "@/lib/db/repositories/orgs";
import { upsertOrgMembership } from "@/lib/db/repositories/org-memberships";

dotenv.config({ path: ".env.local" });
dotenv.config();

const PAGE_SIZE = 100;

interface Summary {
  orgs_processed: number;
  memberships_processed: number;
  errors: number;
}

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;

export async function runBackfill(client: ClerkClient): Promise<Summary> {
  const summary: Summary = { orgs_processed: 0, memberships_processed: 0, errors: 0 };

  for await (const org of iterateOrgs(client)) {
    try {
      await upsertOrg({
        id: org.id,
        name: org.name ?? null,
        slug: org.slug ?? null,
        imageUrl: (org as { imageUrl?: string | null }).imageUrl ?? null,
      });
      summary.orgs_processed += 1;
      await backfillMemberships(client, org.id, summary);
    } catch (err) {
      summary.errors += 1;
      console.error("[backfill] org error", { org_id: org.id, err });
    }
  }

  return summary;
}

async function backfillMemberships(
  client: ClerkClient,
  orgId: string,
  summary: Summary,
): Promise<void> {
  for await (const m of iterateMemberships(client, orgId)) {
    try {
      const pud = m.publicUserData;
      if (!pud?.userId) continue;
      await upsertUser({
        id: pud.userId,
        email: pud.identifier ?? null,
        firstName: pud.firstName ?? null,
        lastName: pud.lastName ?? null,
        imageUrl: pud.imageUrl ?? null,
      });
      await upsertOrgMembership({ orgId, userId: pud.userId, role: m.role });
      summary.memberships_processed += 1;
    } catch (err) {
      summary.errors += 1;
      console.error("[backfill] membership error", { org_id: orgId, err });
    }
  }
}

async function* iterateOrgs(client: ClerkClient) {
  let offset = 0;
  while (true) {
    const page = await client.organizations.getOrganizationList({
      limit: PAGE_SIZE,
      offset,
    });
    const items = Array.isArray(page) ? page : page.data;
    if (!items || items.length === 0) return;
    for (const o of items) yield o;
    if (items.length < PAGE_SIZE) return;
    offset += PAGE_SIZE;
  }
}

async function* iterateMemberships(client: ClerkClient, organizationId: string) {
  let offset = 0;
  while (true) {
    const page = await client.organizations.getOrganizationMembershipList({
      organizationId,
      limit: PAGE_SIZE,
      offset,
    });
    const items = Array.isArray(page) ? page : page.data;
    if (!items || items.length === 0) return;
    for (const m of items) yield m;
    if (items.length < PAGE_SIZE) return;
    offset += PAGE_SIZE;
  }
}

async function main(): Promise<void> {
  const summary = await runBackfill(await clerkClient());
  console.log(JSON.stringify(summary));
  process.exit(summary.errors > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[backfill] fatal", err);
    process.exit(1);
  });
}
