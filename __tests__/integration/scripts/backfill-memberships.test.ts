import postgres from "postgres";

import { adminClient, truncateAll } from "../_helpers/db";
import { runBackfill } from "@/.scripts/backfill-memberships";

const shouldRun =
  !!process.env.INTEGRATION_DATABASE_URL &&
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_SECRET_KEY;

interface OrgFixture {
  id: string;
  name?: string;
  members: { userId: string; role: string }[];
}

function fakeClerk(opts: { orgs: OrgFixture[]; failOrgId?: string }) {
  return {
    organizations: {
      getOrganizationList: jest.fn(async ({ offset = 0 }: { offset?: number }) =>
        offset === 0
          ? opts.orgs.map((o) => ({ id: o.id, name: o.name ?? null, slug: null }))
          : [],
      ),
      getOrganizationMembershipList: jest.fn(
        async ({
          organizationId,
          offset = 0,
        }: {
          organizationId: string;
          offset?: number;
        }) => {
          if (organizationId === opts.failOrgId) throw new Error("simulated failure");
          if (offset !== 0) return [];
          const org = opts.orgs.find((o) => o.id === organizationId);
          if (!org) return [];
          return org.members.map((m) => ({
            id: `orgmem_${m.userId}_${organizationId}`,
            role: m.role,
            publicUserData: {
              userId: m.userId,
              firstName: null,
              lastName: null,
              imageUrl: null,
              identifier: `${m.userId}@x.com`,
            },
          }));
        },
      ),
    },
  };
}

(shouldRun ? describe : describe.skip)("US3 — backfill", () => {
  let admin: ReturnType<typeof postgres>;

  beforeAll(() => {
    admin = adminClient();
  });
  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });
  beforeEach(async () => {
    await truncateAll(admin);
  });

  it("first run populates exactly M memberships; second run is idempotent", async () => {
    const fixture = {
      orgs: [
        {
          id: "org_a",
          name: "A",
          members: [
            { userId: "u1", role: "org:admin" },
            { userId: "u2", role: "org:member" },
          ],
        },
        { id: "org_b", name: "B", members: [{ userId: "u3", role: "org:member" }] },
      ],
    };
    const total = fixture.orgs.reduce((n, o) => n + o.members.length, 0);

    const first = await runBackfill(fakeClerk(fixture) as never);
    expect(first.errors).toBe(0);
    expect(first.memberships_processed).toBe(total);
    const rows1 = await admin`select count(*)::int as c from public.org_memberships`;
    expect(rows1[0].c).toBe(total);

    const second = await runBackfill(fakeClerk(fixture) as never);
    expect(second.errors).toBe(0);
    const rows2 = await admin`select count(*)::int as c from public.org_memberships`;
    expect(rows2[0].c).toBe(total);
  });

  it("one failing org does not stop the others", async () => {
    const fixture = {
      orgs: [
        { id: "org_ok", members: [{ userId: "u1", role: "org:member" }] },
        { id: "org_bad", members: [{ userId: "u2", role: "org:member" }] },
      ],
      failOrgId: "org_bad",
    };
    const summary = await runBackfill(fakeClerk(fixture) as never);
    expect(summary.errors).toBeGreaterThanOrEqual(1);
    const rows = await admin`select org_id from public.org_memberships order by org_id`;
    expect(rows.map((r) => r.org_id)).toEqual(["org_ok"]);
  });
});
