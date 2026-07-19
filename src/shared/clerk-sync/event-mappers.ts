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

export const ClerkUserPayload = z.object({
  id: z.string().min(1),
  email_addresses: z
    .array(z.object({ id: z.string(), email_address: z.string() }))
    .optional(),
  primary_email_address_id: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

export type ClerkUserPayloadT = z.infer<typeof ClerkUserPayload>;

/** E-mail primário (mesma resolução usada para gravar `users.email`). */
function primaryEmailOf(data: ClerkUserPayloadT): string | null {
  const primary = data.email_addresses?.find(
    (email) => email.id === data.primary_email_address_id,
  );
  return primary?.email_address ?? null;
}

/**
 * Nome de exibição do tenant pessoal provisionado no cadastro. Sem first/last
 * name (comum em cadastro via magic link/OAuth mínimo), deriva do local-part do
 * e-mail primário — **nunca `null`**: `orgs.name` nunca fica sem rótulo.
 */
export function nameFromUser(data: ClerkUserPayloadT): string {
  const parts = [data.first_name, data.last_name].filter((part): part is string =>
    Boolean(part),
  );
  if (parts.length > 0) return parts.join(" ");

  const email = primaryEmailOf(data);
  const localPart = email?.split("@")[0]?.trim();
  return localPart && localPart.length > 0 ? localPart : "Usuário";
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
