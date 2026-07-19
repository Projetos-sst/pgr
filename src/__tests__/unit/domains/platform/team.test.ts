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
  it("compõe o nome de first+last e rotula o papel (tenant pessoal, papel literal owner)", () => {
    const view = toTeamMemberView(
      row({ role: "owner", firstName: "Ana", lastName: "Lima" }),
    );
    expect(view.name).toBe("Ana Lima");
    expect(view.role).toBe("owner");
    expect(view.roleLabel).toBe(ROLE_LABEL.owner);
  });

  // Regressão do bug de QA: em orgs Clerk-backed, `org_memberships.role` guarda o
  // papel CRU do Clerk ("org:admin"/"org:member"), não o vocabulário de domínio —
  // sem normalizar, um admin real era rotulado "Membro" (ROLE_LABEL não tinha a
  // chave "org:admin").
  it("normaliza papel cru do Clerk (org:admin → Administrador)", () => {
    const view = toTeamMemberView(row({ role: "org:admin" }));
    expect(view.role).toBe("owner");
    expect(view.roleLabel).toBe("Administrador");
  });

  it("normaliza papel cru do Clerk (org:member → Colaborador)", () => {
    const view = toTeamMemberView(row({ role: "org:member" }));
    expect(view.role).toBe("collaborator");
    expect(view.roleLabel).toBe("Colaborador");
  });

  it("cai para e-mail quando não há nome; papel desconhecido vira o de menor privilégio (Cliente)", () => {
    const view = toTeamMemberView(
      row({ role: "weird", firstName: null, lastName: null, email: "x@y.com" }),
    );
    expect(view.name).toBe("x@y.com");
    expect(view.role).toBe("client");
    expect(view.roleLabel).toBe("Cliente");
  });
});
