import { auth } from "@clerk/nextjs/server";
import { requireAuth } from "../require-auth";
import { UnauthorizedError } from "../errors";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

describe("requireAuth", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
  });

  it("lança UnauthorizedError quando anônimo", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: false,
      userId: null,
      sessionId: null,
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("lança UnauthorizedError quando sessão inválida (sem userId)", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: null,
      sessionId: "sess_1",
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("retorna AuthContext quando autenticado", async () => {
    mockedAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_1",
      sessionId: "sess_1",
    } as unknown as Awaited<ReturnType<typeof auth>>);

    await expect(requireAuth()).resolves.toEqual({
      userId: "user_1",
      sessionId: "sess_1",
    });
  });
});
