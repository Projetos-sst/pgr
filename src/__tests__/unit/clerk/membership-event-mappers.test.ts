import {
  OrganizationMembershipPayload,
  toOrgMembershipRow,
  toOrgRow,
  toUserRow,
} from "@/lib/clerk/membership-event-mappers";

const validPayload = {
  id: "orgmem_123",
  role: "org:admin",
  organization: {
    id: "org_abc",
    name: "Acme",
    slug: "acme",
    image_url: "https://img/acme.png",
  },
  public_user_data: {
    user_id: "user_xyz",
    first_name: "Ada",
    last_name: "Lovelace",
    image_url: "https://img/ada.png",
    identifier: "ada@example.com",
  },
};

describe("membership-event-mappers", () => {
  it("parses a valid payload", () => {
    const parsed = OrganizationMembershipPayload.parse(validPayload);
    expect(parsed.id).toBe("orgmem_123");
    expect(parsed.role).toBe("org:admin");
  });

  it("toUserRow maps user data", () => {
    const row = toUserRow(OrganizationMembershipPayload.parse(validPayload));
    expect(row).toEqual({
      id: "user_xyz",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      imageUrl: "https://img/ada.png",
    });
  });

  it("toOrgRow maps org data", () => {
    const row = toOrgRow(OrganizationMembershipPayload.parse(validPayload));
    expect(row).toEqual({
      id: "org_abc",
      name: "Acme",
      slug: "acme",
      imageUrl: "https://img/acme.png",
    });
  });

  it("toOrgMembershipRow maps composite key + role", () => {
    const row = toOrgMembershipRow(OrganizationMembershipPayload.parse(validPayload));
    expect(row).toEqual({
      orgId: "org_abc",
      userId: "user_xyz",
      role: "org:admin",
    });
  });

  it("missing optional fields become null in mapped rows", () => {
    const partial = {
      id: "orgmem_1",
      role: "org:member",
      organization: { id: "org_a" },
      public_user_data: { user_id: "user_b" },
    };
    const parsed = OrganizationMembershipPayload.parse(partial);
    expect(toUserRow(parsed)).toEqual({
      id: "user_b",
      email: null,
      firstName: null,
      lastName: null,
      imageUrl: null,
    });
    expect(toOrgRow(parsed)).toEqual({
      id: "org_a",
      name: null,
      slug: null,
      imageUrl: null,
    });
  });

  it("throws Zod error for invalid payload (missing required field)", () => {
    expect(() => OrganizationMembershipPayload.parse({ id: "x", role: "y" })).toThrow();
  });
});
