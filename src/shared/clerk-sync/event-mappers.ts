import { z } from "zod";

import type { NewOrg, NewOrgMembership, NewUser } from "@/shared/db/schema";

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
  const user = payload.public_user_data;
  return {
    id: user.user_id,
    email: user.identifier ?? null,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    imageUrl: user.image_url ?? null,
  };
}

export function toOrgRow(payload: OrganizationMembershipPayloadT): NewOrg {
  const org = payload.organization;
  return {
    id: org.id,
    name: org.name ?? null,
    slug: org.slug ?? null,
    imageUrl: org.image_url ?? null,
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

export type ClerkUserEventData = {
  id: string;
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

export type ClerkOrgEventData = {
  id: string;
  name: string;
  slug?: string | null;
  image_url?: string | null;
};

export function userEventToRow(data: ClerkUserEventData): NewUser {
  const primaryEmail = data.email_addresses?.find(
    (email) => email.id === data.primary_email_address_id,
  );
  return {
    id: data.id,
    email: primaryEmail?.email_address ?? null,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    imageUrl: data.image_url ?? null,
  };
}

export function orgEventToRow(data: ClerkOrgEventData): NewOrg {
  return {
    id: data.id,
    name: data.name,
    slug: data.slug ?? null,
    imageUrl: data.image_url ?? null,
  };
}
