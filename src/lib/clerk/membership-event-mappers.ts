import { z } from "zod";

import type { NewOrg, NewOrgMembership, NewUser } from "@/lib/db/schema";

export const OrganizationMembershipPayload = z.object({
  id: z.string(),
  role: z.string(),
  organization: z.object({
    id: z.string(),
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
  }),
  public_user_data: z.object({
    user_id: z.string(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    identifier: z.string().nullable().optional(),
  }),
});

export type OrganizationMembershipPayloadT = z.infer<
  typeof OrganizationMembershipPayload
>;

export function toUserRow(payload: OrganizationMembershipPayloadT): NewUser {
  const u = payload.public_user_data;
  return {
    id: u.user_id,
    email: u.identifier ?? null,
    firstName: u.first_name ?? null,
    lastName: u.last_name ?? null,
    imageUrl: u.image_url ?? null,
  };
}

export function toOrgRow(payload: OrganizationMembershipPayloadT): NewOrg {
  const o = payload.organization;
  return {
    id: o.id,
    name: o.name ?? null,
    slug: o.slug ?? null,
    imageUrl: o.image_url ?? null,
  };
}

export function toOrgMembershipRow(
  payload: OrganizationMembershipPayloadT,
): NewOrgMembership {
  return {
    orgId: payload.organization.id,
    userId: payload.public_user_data.user_id,
    role: payload.role,
  };
}
