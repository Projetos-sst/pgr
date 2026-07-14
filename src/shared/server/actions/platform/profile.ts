"use server";

import { revalidatePath } from "next/cache";

import type { ProfileInput, ProfileView } from "@/shared/domains/platform/profile";
import { officeAction } from "@/shared/server/office-action";
import { getMyProfile, updateMyProfile } from "@/shared/server/platform/profile-core";
import type { ActionResult } from "@/shared/server/result";

export async function getProfile(): Promise<ActionResult<ProfileView>> {
  return officeAction("platform.profile.get", (ctx) => getMyProfile(ctx));
}

export async function updateProfile(
  input: ProfileInput,
): Promise<ActionResult<ProfileView>> {
  return officeAction(
    "platform.profile.update",
    async (ctx) => {
      const view = await updateMyProfile(ctx, input);
      revalidatePath("/perfil");
      return view;
    },
    { audit: true },
  );
}
