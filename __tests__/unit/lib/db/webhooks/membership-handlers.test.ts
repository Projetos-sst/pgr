/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@clerk/nextjs/webhooks", () => ({
  verifyWebhook: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
        match: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}));
jest.mock("@/lib/db/repositories/users", () => ({
  upsertUser: jest.fn(async () => ({})),
}));
jest.mock("@/lib/db/repositories/orgs", () => ({
  upsertOrg: jest.fn(async () => ({})),
}));
jest.mock("@/lib/db/repositories/org-memberships", () => ({
  upsertOrgMembership: jest.fn(async () => ({})),
  deleteOrgMembership: jest.fn(async () => undefined),
}));

import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { POST } from "@/app/api/webhooks/clerk/route";
import * as usersRepo from "@/lib/db/repositories/users";
import * as orgsRepo from "@/lib/db/repositories/orgs";
import * as mRepo from "@/lib/db/repositories/org-memberships";

const validMembershipData = {
  id: "orgmem_1",
  role: "org:admin",
  organization: { id: "org_a", name: "Acme", slug: "acme", image_url: null },
  public_user_data: {
    user_id: "user_a",
    first_name: "A",
    last_name: "B",
    image_url: null,
    identifier: "a@b.com",
  },
};

function fakeReq() {
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    body: "{}",
  });
}

describe("clerk webhook — membership handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("invalid Svix signature → 400, no parsing", async () => {
    (verifyWebhook as jest.Mock).mockRejectedValueOnce(new Error("bad sig"));
    const res = await POST(fakeReq());
    expect(res.status).toBe(400);
    expect(usersRepo.upsertUser).not.toHaveBeenCalled();
  });

  it("organizationMembership.created → upserts user, org, membership in order", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValueOnce({
      type: "organizationMembership.created",
      data: validMembershipData,
    });
    const order: string[] = [];
    (usersRepo.upsertUser as jest.Mock).mockImplementation(async () => {
      order.push("user");
    });
    (orgsRepo.upsertOrg as jest.Mock).mockImplementation(async () => {
      order.push("org");
    });
    (mRepo.upsertOrgMembership as jest.Mock).mockImplementation(async () => {
      order.push("membership");
    });

    const res = await POST(fakeReq());
    expect(res.status).toBe(200);
    expect(order).toEqual(["user", "org", "membership"]);
    expect(mRepo.deleteOrgMembership).not.toHaveBeenCalled();
    expect(usersRepo.upsertUser).toHaveBeenCalledWith({
      id: "user_a",
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      imageUrl: null,
    });
    expect(mRepo.upsertOrgMembership).toHaveBeenCalledWith({
      orgId: "org_a",
      userId: "user_a",
      role: "org:admin",
    });
  });

  it("organizationMembership.updated → runs the full upsert chain with new role", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValueOnce({
      type: "organizationMembership.updated",
      data: { ...validMembershipData, role: "org:member" },
    });
    const res = await POST(fakeReq());
    expect(res.status).toBe(200);
    expect(mRepo.upsertOrgMembership).toHaveBeenCalledWith(
      expect.objectContaining({ role: "org:member" }),
    );
  });

  it("organizationMembership.deleted → only calls deleteOrgMembership", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValueOnce({
      type: "organizationMembership.deleted",
      data: validMembershipData,
    });
    const res = await POST(fakeReq());
    expect(res.status).toBe(200);
    expect(mRepo.deleteOrgMembership).toHaveBeenCalledWith({
      orgId: "org_a",
      userId: "user_a",
    });
    expect(usersRepo.upsertUser).not.toHaveBeenCalled();
    expect(orgsRepo.upsertOrg).not.toHaveBeenCalled();
    expect(mRepo.upsertOrgMembership).not.toHaveBeenCalled();
  });

  it("invalid membership payload → 400, no repository calls", async () => {
    (verifyWebhook as jest.Mock).mockResolvedValueOnce({
      type: "organizationMembership.created",
      data: { id: "x" },
    });
    const res = await POST(fakeReq());
    expect(res.status).toBe(400);
    expect(usersRepo.upsertUser).not.toHaveBeenCalled();
    expect(orgsRepo.upsertOrg).not.toHaveBeenCalled();
    expect(mRepo.upsertOrgMembership).not.toHaveBeenCalled();
  });
});
