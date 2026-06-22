import { requireOfficeStaff } from "@/shared/auth/require-office-staff";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { ForbiddenError } from "@/shared/auth/errors";

jest.mock("@/shared/auth/require-tenant-context", () => ({
  requireTenantContext: jest.fn(),
}));

const mockedCtx = requireTenantContext as jest.MockedFunction<
  typeof requireTenantContext
>;

describe("requireOfficeStaff (FR-065)", () => {
  beforeEach(() => mockedCtx.mockReset());

  it.each(["owner", "collaborator"])("permite papel %s", async (role) => {
    mockedCtx.mockResolvedValue({ userId: "u", tenantId: "t", plan: "free", role });
    await expect(requireOfficeStaff()).resolves.toMatchObject({ role });
  });

  it("nega papel client com ForbiddenError", async () => {
    mockedCtx.mockResolvedValue({
      userId: "u",
      tenantId: "t",
      plan: "free",
      role: "client",
    });
    await expect(requireOfficeStaff()).rejects.toBeInstanceOf(ForbiddenError);
  });
});
