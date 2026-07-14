import {
  inviteMemberSchema,
  ROLE_LABEL,
  toTeamMemberView,
} from "@/shared/domains/platform/team";
import type { TeamMemberRow } from "@/shared/db/repositories/org-memberships";

function row(overrides: Partial<TeamMemberRow>): TeamMemberRow {
  return {
    userId: "u1",
    role: "collaborator",
    scopedCompanyId: null,
    email: "user@example.com",
    firstName: "Ana",
    lastName: "Lima",
    imageUrl: null,
    jobTitle: "Engenheira",
    ...overrides,
  };
}

describe("inviteMemberSchema", () => {
  it("aceita e-mail válido + papel do enum", () => {
    expect(
      inviteMemberSchema.safeParse({ email: "a@b.com", role: "collaborator" }).success,
    ).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    expect(inviteMemberSchema.safeParse({ email: "nope", role: "owner" }).success).toBe(
      false,
    );
  });

  it("rejeita papel fora do enum", () => {
    expect(inviteMemberSchema.safeParse({ email: "a@b.com", role: "root" }).success).toBe(
      false,
    );
  });
});

describe("toTeamMemberView", () => {
  it("compõe o nome de first+last e rotula o papel", () => {
    const view = toTeamMemberView(
      row({ role: "owner", firstName: "Ana", lastName: "Lima" }),
    );
    expect(view.name).toBe("Ana Lima");
    expect(view.roleLabel).toBe(ROLE_LABEL.owner);
  });

  it("cai para e-mail quando não há nome; papel desconhecido vira 'Membro'", () => {
    const view = toTeamMemberView(
      row({ role: "weird", firstName: null, lastName: null, email: "x@y.com" }),
    );
    expect(view.name).toBe("x@y.com");
    expect(view.roleLabel).toBe("Membro");
  });
});
