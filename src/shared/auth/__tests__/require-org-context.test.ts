import { auth } from "@clerk/nextjs/server";
import { requireOrgContext } from "../require-org-context";
import { NoActiveOrgError, UnauthorizedError } from "../errors";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

describe("requireOrgContext", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
  });

  it("lança UnauthorizedError quando anônimo", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: false,
      userId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(requireOrgContext()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("lança NoActiveOrgError quando autenticado sem org", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: null,
      orgRole: null,
      orgSlug: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(requireOrgContext()).rejects.toBeInstanceOf(NoActiveOrgError);
  });

  it("retorna OrgAuthContext quando autenticado com org", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: "org_1",
      orgRole: "org:admin",
      orgSlug: "acme",
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(requireOrgContext()).resolves.toEqual({
      userId: "user_1",
      sessionId: "sess_1",
      orgId: "org_1",
      orgRole: "org:admin",
      orgSlug: "acme",
    });
  });

  it("usuário removido da org ativa (sessão perde orgId) → NoActiveOrgError (FR-010)", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: null,
      orgRole: null,
      orgSlug: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(requireOrgContext()).rejects.toBeInstanceOf(NoActiveOrgError);
  });

  it("resolve o orgId exclusivamente da sessão e ignora qualquer argumento (Princípio I)", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
      orgId: "org_SESSION",
      orgRole: null,
      orgSlug: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    const resolveWithInput = requireOrgContext as unknown as (input?: {
      orgId: string;
    }) => Promise<{ orgId: string }>;

    await expect(resolveWithInput({ orgId: "org_FAKE" })).resolves.toMatchObject({
      orgId: "org_SESSION",
    });
  });
});
