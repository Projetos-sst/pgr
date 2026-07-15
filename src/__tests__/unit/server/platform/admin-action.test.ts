jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/shared/auth/require-master", () => ({
  requireMaster: jest.fn().mockResolvedValue({ userId: "master-1" }),
}));
jest.mock("@/shared/db/repositories/admin", () => ({
  listMasters: jest.fn(),
  aiUsageByOrg: jest.fn(),
  findUserByEmail: jest.fn(),
  setUserMaster: jest.fn(),
  countMasters: jest.fn(),
}));

import * as adminRepo from "@/shared/db/repositories/admin";
import {
  demoteMasterAction,
  promoteMasterByEmailAction,
} from "@/shared/server/actions/platform/admin";

const asMock = (fn: unknown) => fn as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("demoteMasterAction", () => {
  it("bloqueia remover o último master (FORBIDDEN)", async () => {
    asMock(adminRepo.countMasters).mockResolvedValue(1);
    const result = await demoteMasterAction("master-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(adminRepo.setUserMaster).not.toHaveBeenCalled();
  });

  it("remove quando há mais de um master", async () => {
    asMock(adminRepo.countMasters).mockResolvedValue(2);
    const result = await demoteMasterAction("master-2");
    expect(result.ok).toBe(true);
    expect(adminRepo.setUserMaster).toHaveBeenCalledWith("master-2", false);
  });
});

describe("promoteMasterByEmailAction", () => {
  it("e-mail inexistente → NOT_FOUND, não promove", async () => {
    asMock(adminRepo.findUserByEmail).mockResolvedValue(null);
    const result = await promoteMasterByEmailAction("ghost@x.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(adminRepo.setUserMaster).not.toHaveBeenCalled();
  });

  it("promove usuário existente (normaliza o e-mail)", async () => {
    asMock(adminRepo.findUserByEmail).mockResolvedValue({
      id: "u-9",
      email: "a@b.com",
      name: "Ana",
    });
    const result = await promoteMasterByEmailAction("  A@B.com ");
    expect(result.ok).toBe(true);
    expect(adminRepo.findUserByEmail).toHaveBeenCalledWith("a@b.com");
    expect(adminRepo.setUserMaster).toHaveBeenCalledWith("u-9", true);
  });
});
