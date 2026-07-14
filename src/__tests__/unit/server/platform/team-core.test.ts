jest.mock("@/shared/db/repositories/org-memberships", () => ({
  listMembershipsByOrg: jest.fn(),
  getOrgMembership: jest.fn(),
  updateMembershipRole: jest.fn(),
  countOwnersByOrg: jest.fn(),
}));
jest.mock("@/shared/db/repositories/orgs", () => ({ getOrgById: jest.fn() }));
jest.mock("@/shared/integrations/clerk/organizations", () => ({
  createOrgInvitation: jest.fn(),
  updateOrgMembershipRole: jest.fn(),
  removeOrgMembership: jest.fn(),
}));

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as memberships from "@/shared/db/repositories/org-memberships";
import * as orgs from "@/shared/db/repositories/orgs";
import * as clerkOrg from "@/shared/integrations/clerk/organizations";
import {
  inviteTeamMember,
  listTeam,
  removeTeamMember,
  updateTeamMemberRole,
} from "@/shared/server/platform/team-core";

const asMock = (fn: unknown) => fn as jest.Mock;

function ctx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    userId: "owner-1",
    tenantId: "org_a",
    role: "owner",
    plan: "pro",
    ...overrides,
  };
}

function membershipRow(role: string) {
  return {
    orgId: "org_a",
    userId: "member-2",
    role,
    scopedCompanyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  asMock(orgs.getOrgById).mockResolvedValue({
    id: "org_a",
    name: "Escritório A",
    slug: null,
    imageUrl: null,
    plan: "pro",
    clerkOrgId: "clerk_a",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

describe("inviteTeamMember", () => {
  it("owner PRO convida via Clerk com papel mapeado", async () => {
    const result = await inviteTeamMember(ctx(), {
      email: "new@x.com",
      role: "collaborator",
    });
    expect(result).toEqual({ email: "new@x.com", role: "collaborator" });
    expect(clerkOrg.createOrgInvitation).toHaveBeenCalledWith({
      clerkOrgId: "clerk_a",
      inviterUserId: "owner-1",
      email: "new@x.com",
      role: "collaborator",
    });
  });

  it("não-owner é barrado (FORBIDDEN) antes de qualquer chamada", async () => {
    await expect(
      inviteTeamMember(ctx({ role: "collaborator" }), {
        email: "a@b.com",
        role: "collaborator",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(clerkOrg.createOrgInvitation).not.toHaveBeenCalled();
  });

  it("plano free é barrado sem chamar o Clerk (multiusuário é PRO)", async () => {
    await expect(
      inviteTeamMember(ctx({ plan: "free" }), { email: "a@b.com", role: "owner" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(orgs.getOrgById).not.toHaveBeenCalled();
    expect(clerkOrg.createOrgInvitation).not.toHaveBeenCalled();
  });

  it("org sem clerk_org_id é barrada", async () => {
    asMock(orgs.getOrgById).mockResolvedValue({
      id: "org_a",
      name: null,
      slug: null,
      imageUrl: null,
      plan: "pro",
      clerkOrgId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      inviteTeamMember(ctx(), { email: "a@b.com", role: "owner" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("updateTeamMemberRole", () => {
  it("bloqueia rebaixar o último administrador", async () => {
    asMock(memberships.getOrgMembership).mockResolvedValue(membershipRow("owner"));
    asMock(memberships.countOwnersByOrg).mockResolvedValue(1);
    await expect(
      updateTeamMemberRole(ctx(), "member-2", { role: "collaborator" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(clerkOrg.updateOrgMembershipRole).not.toHaveBeenCalled();
  });

  it("membro inexistente → NOT_FOUND", async () => {
    asMock(memberships.getOrgMembership).mockResolvedValue(null);
    await expect(
      updateTeamMemberRole(ctx(), "ghost", { role: "collaborator" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("caminho feliz chama o Clerk", async () => {
    asMock(memberships.getOrgMembership).mockResolvedValue(membershipRow("collaborator"));
    await updateTeamMemberRole(ctx(), "member-2", { role: "owner" });
    expect(clerkOrg.updateOrgMembershipRole).toHaveBeenCalledWith({
      clerkOrgId: "clerk_a",
      userId: "member-2",
      role: "owner",
    });
  });
});

describe("removeTeamMember", () => {
  it("não permite remover a si mesmo", async () => {
    await expect(removeTeamMember(ctx(), "owner-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("bloqueia remover o último administrador", async () => {
    asMock(memberships.getOrgMembership).mockResolvedValue(membershipRow("owner"));
    asMock(memberships.countOwnersByOrg).mockResolvedValue(1);
    await expect(removeTeamMember(ctx(), "member-2")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(clerkOrg.removeOrgMembership).not.toHaveBeenCalled();
  });

  it("caminho feliz chama o Clerk", async () => {
    asMock(memberships.getOrgMembership).mockResolvedValue(membershipRow("collaborator"));
    await removeTeamMember(ctx(), "member-2");
    expect(clerkOrg.removeOrgMembership).toHaveBeenCalledWith({
      clerkOrgId: "clerk_a",
      userId: "member-2",
    });
  });
});

describe("listTeam", () => {
  it("consulta escopada pelo tenant da sessão e mapeia para a view", async () => {
    asMock(memberships.listMembershipsByOrg).mockResolvedValue({
      rows: [
        {
          userId: "member-2",
          role: "collaborator",
          scopedCompanyId: null,
          email: "m@x.com",
          firstName: "Bia",
          lastName: null,
          imageUrl: null,
          jobTitle: null,
        },
      ],
      total: 1,
    });
    const result = await listTeam(ctx(), { search: "bia" });
    expect(asMock(memberships.listMembershipsByOrg).mock.calls[0][0]).toBe("org_a");
    expect(result.total).toBe(1);
    expect(result.rows[0].name).toBe("Bia");
  });
});
