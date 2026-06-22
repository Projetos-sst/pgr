jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/db/repositories/org-memberships", () => ({
  listTenantMembershipsByUser: jest.fn(),
}));
jest.mock("@/shared/tenant/audit-log", () => ({ logTenantEvent: jest.fn() }));

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { listTenantMembershipsByUser } from "@/shared/db/repositories/org-memberships";
import { logTenantEvent } from "@/shared/tenant/audit-log";
import { ACTIVE_ORG_COOKIE } from "@/shared/tenant/org-switch";
import { switchTenantAction } from "@/shared/server/actions/switch-tenant";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockedList = listTenantMembershipsByUser as jest.MockedFunction<
  typeof listTenantMembershipsByUser
>;
const mockedLog = logTenantEvent as jest.MockedFunction<typeof logTenantEvent>;

const cookieSet = jest.fn();

function authenticated() {
  mockedAuth.mockResolvedValue({
    isAuthenticated: true,
    userId: "user_1",
    sessionId: "sess_1",
    orgId: null,
    orgRole: null,
    orgSlug: null,
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function membership(orgId: string) {
  return {
    orgId,
    name: null,
    role: "owner",
    scopedCompanyId: null,
    plan: "free",
    clerkOrgId: null,
  };
}

describe("switchTenantAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticated();
    mockedCookies.mockResolvedValue({ set: cookieSet } as never);
  });

  it("alvo é membership do usuário → grava cookie httpOnly + loga troca + ok", async () => {
    mockedList.mockResolvedValue([membership("org_pessoal"), membership("org_terceiro")]);

    const result = await switchTenantAction("org_terceiro");

    expect(result).toEqual({ ok: true, data: { orgId: "org_terceiro" } });
    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVE_ORG_COOKIE,
      "org_terceiro",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: true }),
    );
    expect(mockedLog).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({
        operation: "tenant.org_switched",
        orgId: "org_terceiro",
      }),
    );
  });

  it("alvo NÃO é membership do usuário → FORBIDDEN, sem gravar cookie (Princípio I)", async () => {
    mockedList.mockResolvedValue([membership("org_pessoal")]);

    const result = await switchTenantAction("org_de_outro_usuario");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(cookieSet).not.toHaveBeenCalled();
    expect(mockedLog).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({ operation: "tenant.org_switch", outcome: "blocked" }),
    );
  });
});
