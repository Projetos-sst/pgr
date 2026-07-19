import {
  nameFromUser,
  OrganizationMembershipPayload,
  orgEventToRow,
  toOrgMembershipRow,
  toOrgRow,
  toUserRow,
  userEventToRow,
} from "@/shared/clerk-sync/event-mappers";

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

describe("user-event mapper", () => {
  it("picks the primary email and maps user fields", () => {
    const row = userEventToRow({
      id: "user_1",
      primary_email_address_id: "email_2",
      email_addresses: [
        { id: "email_1", email_address: "old@example.com" },
        { id: "email_2", email_address: "primary@example.com" },
      ],
      first_name: "Grace",
      last_name: "Hopper",
      image_url: "https://img/grace.png",
    });
    expect(row).toEqual({
      id: "user_1",
      email: "primary@example.com",
      firstName: "Grace",
      lastName: "Hopper",
      imageUrl: "https://img/grace.png",
    });
  });

  it("maps email to null when no address matches the primary id", () => {
    const row = userEventToRow({
      id: "user_2",
      primary_email_address_id: null,
      email_addresses: [],
      first_name: null,
      last_name: null,
      image_url: null,
    });
    expect(row).toEqual({
      id: "user_2",
      email: null,
      firstName: null,
      lastName: null,
      imageUrl: null,
    });
  });
});

describe("nameFromUser (fallback do nome do tenant pessoal — self-signup)", () => {
  it("usa first_name + last_name quando presentes", () => {
    expect(
      nameFromUser({
        id: "user_1",
        first_name: "Ada",
        last_name: "Lovelace",
        primary_email_address_id: "e1",
        email_addresses: [{ id: "e1", email_address: "ada@example.com" }],
      }),
    ).toBe("Ada Lovelace");
  });

  it("usa só first_name quando last_name ausente", () => {
    expect(
      nameFromUser({
        id: "user_1",
        first_name: "Ada",
        last_name: null,
        primary_email_address_id: "e1",
        email_addresses: [{ id: "e1", email_address: "ada@example.com" }],
      }),
    ).toBe("Ada");
  });

  // Regressão (CTO): sem first/last name (cadastro aberto via magic link/OAuth
  // mínimo), o nome do tenant NUNCA pode ficar null — deriva do local-part do
  // e-mail primário.
  it("sem first/last name: deriva do local-part do e-mail primário", () => {
    expect(
      nameFromUser({
        id: "user_1",
        first_name: null,
        last_name: null,
        primary_email_address_id: "e1",
        email_addresses: [{ id: "e1", email_address: "grace.hopper@example.com" }],
      }),
    ).toBe("grace.hopper");
  });

  it("sem first/last name e sem e-mail primário casando: fallback fixo 'Usuário' (nunca null)", () => {
    expect(
      nameFromUser({
        id: "user_1",
        first_name: null,
        last_name: null,
        primary_email_address_id: "missing",
        email_addresses: [{ id: "e1", email_address: "grace@example.com" }],
      }),
    ).toBe("Usuário");
  });

  it("sem first/last name e sem nenhum e-mail: fallback fixo 'Usuário'", () => {
    expect(
      nameFromUser({
        id: "user_1",
        first_name: null,
        last_name: null,
        primary_email_address_id: null,
        email_addresses: [],
      }),
    ).toBe("Usuário");
  });
});

describe("org-event mapper", () => {
  it("maps organization fields", () => {
    const row = orgEventToRow({
      id: "org_1",
      name: "Globex",
      slug: "globex",
      image_url: "https://img/globex.png",
    });
    expect(row).toEqual({
      id: "org_1",
      name: "Globex",
      slug: "globex",
      imageUrl: "https://img/globex.png",
    });
  });

  it("defaults optional fields to null", () => {
    const row = orgEventToRow({ id: "org_2", name: "Initech" });
    expect(row).toEqual({
      id: "org_2",
      name: "Initech",
      slug: null,
      imageUrl: null,
    });
  });
});
