"use server";

import { revalidatePath } from "next/cache";

import { ForbiddenError } from "@/shared/auth/errors";
import * as adminRepo from "@/shared/db/repositories/admin";
import type { MasterUser, OrgAiUsage } from "@/shared/domains/platform/admin";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { masterAction } from "@/shared/server/master-action";
import type { ActionResult } from "@/shared/server/result";

export async function listMastersAction(): Promise<ActionResult<MasterUser[]>> {
  return masterAction(() => adminRepo.listMasters());
}

export async function aiUsageByOrgAction(): Promise<ActionResult<OrgAiUsage[]>> {
  return masterAction(() => adminRepo.aiUsageByOrg());
}

export async function promoteMasterByEmailAction(
  email: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  return masterAction(async () => {
    const user = await adminRepo.findUserByEmail(email.trim().toLowerCase());
    if (!user) throw new NotFoundError();
    await adminRepo.setUserMaster(user.id, true);
    revalidatePath("/admin-global");
    return { id: user.id, name: user.name };
  });
}

export async function demoteMasterAction(
  userId: string,
): Promise<ActionResult<{ userId: string }>> {
  return masterAction(async () => {
    // Proteção: não remover o último administrador da plataforma.
    if ((await adminRepo.countMasters()) <= 1) {
      throw new ForbiddenError(
        "Não é possível remover o último administrador da plataforma.",
      );
    }
    await adminRepo.setUserMaster(userId, false);
    revalidatePath("/admin-global");
    return { userId };
  });
}
