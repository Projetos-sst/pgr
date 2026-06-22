import { auth } from "@clerk/nextjs/server";

import { getSessionOrNull } from "@/shared/auth/get-session";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

const setActiveOrg = (orgId: string | null) =>
  mockedAuth.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_1",
    sessionId: "sess_1",
    orgId,
    orgRole: orgId ? "org:member" : null,
    orgSlug: null,
  } as unknown as Awaited<ReturnType<typeof auth>>);

describe("persistência da organização ativa (FR-008/SC-006)", () => {
  beforeEach(() => mockedAuth.mockReset());

  it("a org ativa vem da sessão Clerk e persiste entre leituras ('reloads')", async () => {
    setActiveOrg("org_a");

    const first = await getSessionOrNull();
    const second = await getSessionOrNull();

    expect(first.orgId).toBe("org_a");
    expect(second.orgId).toBe("org_a");
  });
});
