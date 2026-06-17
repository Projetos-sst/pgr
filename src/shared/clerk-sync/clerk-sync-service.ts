import "server-only";

import type { WebhookEvent } from "@clerk/nextjs/server";

import {
  deleteOrgMembership,
  upsertOrgMembership,
} from "@/shared/db/repositories/org-memberships";
import { deleteOrg, replaceOrg, upsertOrg } from "@/shared/db/repositories/orgs";
import { deleteUser, replaceUser, upsertUser } from "@/shared/db/repositories/users";

import {
  type ClerkOrgEventData,
  type ClerkUserEventData,
  OrganizationMembershipPayload,
  type OrganizationMembershipPayloadT,
  orgEventToRow,
  toOrgMembershipRow,
  toOrgRow,
  toUserRow,
  userEventToRow,
} from "./event-mappers";
import { logClerkSync } from "./log";

export type ClerkSyncResult =
  | { status: "ok" }
  | { status: "ignored" }
  | { status: "invalid_payload" };

const OK: ClerkSyncResult = { status: "ok" };
const IGNORED: ClerkSyncResult = { status: "ignored" };
const INVALID_PAYLOAD: ClerkSyncResult = { status: "invalid_payload" };

export async function handleClerkEvent(event: WebhookEvent): Promise<ClerkSyncResult> {
  switch (event.type) {
    case "user.created":
    case "user.updated":
      return syncUser(event.data);
    case "user.deleted":
      return removeUser(event.data.id);
    case "organization.created":
    case "organization.updated":
      return syncOrg(event.data);
    case "organization.deleted":
      return removeOrg(event.data.id);
    case "organizationMembership.created":
    case "organizationMembership.updated":
      return syncMembership(event);
    case "organizationMembership.deleted":
      return removeMembership(event);
    default:
      return IGNORED;
  }
}

async function syncUser(data: ClerkUserEventData): Promise<ClerkSyncResult> {
  await replaceUser(userEventToRow(data));
  logClerkSync("info", { operation: "user.sync", phase: "finish", user_id: data.id });
  return OK;
}

async function removeUser(id: string | undefined): Promise<ClerkSyncResult> {
  if (!id) return IGNORED;
  await deleteUser(id);
  logClerkSync("info", { operation: "user.delete", phase: "finish", user_id: id });
  return OK;
}

async function syncOrg(data: ClerkOrgEventData): Promise<ClerkSyncResult> {
  await replaceOrg(orgEventToRow(data));
  logClerkSync("info", { operation: "org.sync", phase: "finish", org_id: data.id });
  return OK;
}

async function removeOrg(id: string | undefined): Promise<ClerkSyncResult> {
  if (!id) return IGNORED;
  await deleteOrg(id);
  logClerkSync("info", { operation: "org.delete", phase: "finish", org_id: id });
  return OK;
}

async function syncMembership(event: WebhookEvent): Promise<ClerkSyncResult> {
  const payload = parseMembershipPayload(event);
  if (!payload) return INVALID_PAYLOAD;

  await upsertUser(toUserRow(payload));
  await upsertOrg(toOrgRow(payload));
  await upsertOrgMembership(toOrgMembershipRow(payload));

  logClerkSync("info", {
    operation: "membership.sync",
    phase: "finish",
    org_id: payload.organization.id,
    user_id: payload.public_user_data.user_id,
  });
  return OK;
}

async function removeMembership(event: WebhookEvent): Promise<ClerkSyncResult> {
  const payload = parseMembershipPayload(event);
  if (!payload) return INVALID_PAYLOAD;

  await deleteOrgMembership({
    orgId: payload.organization.id,
    userId: payload.public_user_data.user_id,
  });

  logClerkSync("info", {
    operation: "membership.delete",
    phase: "finish",
    org_id: payload.organization.id,
    user_id: payload.public_user_data.user_id,
  });
  return OK;
}

function parseMembershipPayload(
  event: WebhookEvent,
): OrganizationMembershipPayloadT | null {
  const parsed = OrganizationMembershipPayload.safeParse(event.data);
  if (parsed.success) return parsed.data;

  logClerkSync("error", {
    operation: "membership.sync",
    phase: "rejected",
    type: event.type,
    reason: "invalid_payload",
  });
  return null;
}
