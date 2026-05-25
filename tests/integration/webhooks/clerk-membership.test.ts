import postgres from "postgres";

import { upsertUser } from "@/lib/db/repositories/users";
import { upsertOrg } from "@/lib/db/repositories/orgs";
import {
  deleteOrgMembership,
  upsertOrgMembership,
} from "@/lib/db/repositories/org-memberships";
import { adminClient, truncateAll } from "../_helpers/db";

const shouldRun =
  !!process.env.INTEGRATION_DATABASE_URL &&
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_SECRET_KEY;

(shouldRun ? describe : describe.skip)("US2 — membership sync", () => {
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

  it("created → inserts row; second delivery is no-op", async () => {
    await upsertUser({ id: "user_a", email: "a@b.com" });
    await upsertOrg({ id: "org_a", name: "Acme" });
    await upsertOrgMembership({ orgId: "org_a", userId: "user_a", role: "org:member" });
    await upsertOrgMembership({ orgId: "org_a", userId: "user_a", role: "org:member" });

    const rows = await admin`
      select org_id, user_id, role from public.org_memberships
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      org_id: "org_a",
      user_id: "user_a",
      role: "org:member",
    });
  });

  it("updated → changes role and advances updated_at", async () => {
    await upsertUser({ id: "user_a" });
    await upsertOrg({ id: "org_a" });
    await upsertOrgMembership({ orgId: "org_a", userId: "user_a", role: "org:member" });
    const before = await admin<{ updated_at: Date }[]>`
      select updated_at from public.org_memberships where org_id = 'org_a'
    `;
    await new Promise((r) => setTimeout(r, 10));
    await upsertOrgMembership({ orgId: "org_a", userId: "user_a", role: "org:admin" });
    const after = await admin<{ role: string; updated_at: Date }[]>`
      select role, updated_at from public.org_memberships where org_id = 'org_a'
    `;
    expect(after[0].role).toBe("org:admin");
    expect(after[0].updated_at.getTime()).toBeGreaterThan(before[0].updated_at.getTime());
  });

  it("deleted → removes row; second deletion is no-op", async () => {
    await upsertUser({ id: "user_a" });
    await upsertOrg({ id: "org_a" });
    await upsertOrgMembership({ orgId: "org_a", userId: "user_a", role: "org:member" });
    await deleteOrgMembership({ orgId: "org_a", userId: "user_a" });
    await deleteOrgMembership({ orgId: "org_a", userId: "user_a" });
    const rows = await admin`select * from public.org_memberships`;
    expect(rows).toHaveLength(0);
  });

  it("membership upsert is defensive: null fields don't overwrite enriched data", async () => {
    await upsertUser({ id: "user_a" });
    await upsertOrg({ id: "org_a" });
    await upsertOrgMembership({ orgId: "org_a", userId: "user_a", role: "org:member" });
    await upsertUser({
      id: "user_a",
      email: "a@b.com",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    await upsertUser({ id: "user_a" });
    const rows =
      await admin`select email, first_name from public.users where id = 'user_a'`;
    expect(rows[0]).toEqual({ email: "a@b.com", first_name: "Ada" });
  });
});
