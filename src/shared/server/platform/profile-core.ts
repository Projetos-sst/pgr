import "server-only";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as usersRepo from "@/shared/db/repositories/users";
import {
  profileInputSchema,
  toProfileView,
  type ProfileInput,
  type ProfileView,
} from "@/shared/domains/platform/profile";
import { NotFoundError } from "@/shared/errors/not-found-error";

export async function getMyProfile(ctx: TenantContext): Promise<ProfileView> {
  const user = await usersRepo.getUserById(ctx.userId);
  if (!user) throw new NotFoundError();
  return toProfileView(user);
}

export async function updateMyProfile(
  ctx: TenantContext,
  input: ProfileInput,
): Promise<ProfileView> {
  const values = profileInputSchema.parse(input);
  const user = await usersRepo.updateUserProfile(ctx.userId, {
    phone: values.phone ?? null,
    cpf: values.cpf ?? null,
    jobTitle: values.jobTitle ?? null,
  });
  return toProfileView(user);
}
