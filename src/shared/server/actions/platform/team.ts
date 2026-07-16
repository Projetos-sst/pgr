"use server";

import { revalidatePath } from "next/cache";

import type {
  InviteMemberInput,
  TeamMemberView,
  UpdateMemberRoleValues,
} from "@/shared/domains/platform/team";
import { officeAction } from "@/shared/server/office-action";
import {
  inviteTeamMember,
  listTeam,
  removeTeamMember,
  updateTeamMemberRole,
} from "@/shared/server/platform/team-core";
import type { ActionResult } from "@/shared/server/result";
import type { Paginated } from "@/shared/pagination";

export async function listTeamMembers(
  params: { search?: string; page?: number; pageSize?: number } = {},
): Promise<ActionResult<Paginated<TeamMemberView>>> {
  return officeAction("platform.team.list", (ctx) => listTeam(ctx, params));
}

export async function inviteMember(
  input: InviteMemberInput,
): Promise<ActionResult<{ email: string; role: string }>> {
  return officeAction(
    "platform.team.invite",
    async (ctx) => {
      const result = await inviteTeamMember(ctx, input);
      revalidatePath("/team");
      return result;
    },
    { audit: true },
  );
}

export async function changeMemberRole(
  userId: string,
  input: UpdateMemberRoleValues,
): Promise<ActionResult<{ userId: string; role: string }>> {
  return officeAction(
    "platform.team.role",
    async (ctx) => {
      const result = await updateTeamMemberRole(ctx, userId, input);
      revalidatePath("/team");
      return result;
    },
    { audit: true },
  );
}

export async function removeMember(
  userId: string,
): Promise<ActionResult<{ removed: true }>> {
  return officeAction(
    "platform.team.remove",
    async (ctx) => {
      await removeTeamMember(ctx, userId);
      revalidatePath("/team");
      return { removed: true as const };
    },
    { audit: true },
  );
}
