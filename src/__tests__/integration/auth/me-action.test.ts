import { auth } from "@clerk/nextjs/server";

import { meAction } from "@/shared/server/actions/me";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

const setSession = (
  session: Partial<{
    isAuthenticated: boolean;
    userId: string | null;
    sessionId: string | null;
    orgId: string | null;
    orgRole: string | null;
    orgSlug: string | null;
  }>,
) => {
  mockedAuth.mockResolvedValue({
    isAuthenticated: false,
    userId: null,
    sessionId: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    ...session,
  } as unknown as Awaited<ReturnType<typeof auth>>);
};

describe("meAction", () => {
  beforeEach(() => mockedAuth.mockReset());

  it("retorna UNAUTHORIZED sem sessão", async () => {
    setSession({ isAuthenticated: false });
    await expect(meAction()).resolves.toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  it("retorna NO_ACTIVE_ORG quando autenticado sem org", async () => {
    setSession({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: null,
    });
    await expect(meAction()).resolves.toEqual({
      ok: false,
      error: "NO_ACTIVE_ORG",
    });
  });

  it("retorna { userId, orgId } quando autenticado com org ativa", async () => {
    setSession({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: "org_1",
    });
    await expect(meAction()).resolves.toEqual({
      ok: true,
      userId: "user_1",
      orgId: "org_1",
    });
  });

  it("ignora orgId passado como argumento extra (constituição §I)", async () => {
    setSession({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: "org_SESSION",
    });
    const action = meAction as unknown as (fake?: { orgId: string }) => Promise<unknown>;
    await expect(action({ orgId: "org_FAKE" })).resolves.toEqual({
      ok: true,
      userId: "user_1",
      orgId: "org_SESSION",
    });
  });

  it("troca de org entre chamadas não tem cache cruzado (T033 / SC-006)", async () => {
    setSession({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: "org_A",
    });
    await expect(meAction()).resolves.toEqual({
      ok: true,
      userId: "user_1",
      orgId: "org_A",
    });

    setSession({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: "org_B",
    });
    await expect(meAction()).resolves.toEqual({
      ok: true,
      userId: "user_1",
      orgId: "org_B",
    });
  });
});
