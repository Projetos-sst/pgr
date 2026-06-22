import { auth } from "@clerk/nextjs/server";

import { meAction } from "@/shared/server/actions/me";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

const setActiveOrg = (orgId: string) =>
  mockedAuth.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_1",
    sessionId: "sess_1",
    orgId,
    orgRole: "org:member",
    orgSlug: null,
  } as unknown as Awaited<ReturnType<typeof auth>>);

describe("troca de organização ativa", () => {
  beforeEach(() => mockedAuth.mockReset());

  it("a leitura usa sempre o orgId ativo da sessão (sem cache cruzado entre tenants)", async () => {
    setActiveOrg("org_a");
    await expect(meAction()).resolves.toEqual({
      ok: true,
      userId: "user_1",
      orgId: "org_a",
    });

    setActiveOrg("org_b");
    await expect(meAction()).resolves.toEqual({
      ok: true,
      userId: "user_1",
      orgId: "org_b",
    });
  });
});
