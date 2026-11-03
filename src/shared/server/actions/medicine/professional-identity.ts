"use server";
import { revalidatePath } from "next/cache";

import { masterAction } from "@/shared/server/master-action";
import { officeAction } from "@/shared/server/office-action";
import {
  approveVerification,
  myProfessionalIdentity,
  reconfirmLink,
  rejectRequest,
  requestVerification,
  revokeVerification,
  verificationQueue,
} from "@/shared/server/medicine/identity-verification-core";

const MY_PATH = "/professional-identity";
const QUEUE_PATH = "/admin-global/identity-verifications";

// ── Profissional: qualquer conta do escritório que assume um cadastro ───────

export async function getMyProfessionalIdentityAction() {
  return officeAction("medicine.identity.mine", (ctx) => myProfessionalIdentity(ctx), {
    tenantAccess: true,
  });
}

export async function requestIdentityVerificationAction(input: unknown) {
  return officeAction(
    "medicine.identity.request",
    async (ctx) => {
      const row = await requestVerification(ctx, input);
      revalidatePath(MY_PATH);
      return row;
    },
    { tenantAccess: true, audit: true },
  );
}

export async function reconfirmLegacyLinkAction(linkId: string) {
  return officeAction(
    "medicine.identity.reconfirm",
    async (ctx) => {
      const row = await reconfirmLink(ctx, linkId);
      revalidatePath(MY_PATH);
      return row;
    },
    { tenantAccess: true, audit: true },
  );
}

// ── Operador da plataforma: master E designado no banco ─────────────────────

export async function getVerificationQueueAction() {
  return masterAction((ctx) => verificationQueue(ctx.userId));
}

export async function approveIdentityVerificationAction(input: unknown) {
  return masterAction(async (ctx) => {
    const row = await approveVerification(ctx.userId, input);
    revalidatePath(QUEUE_PATH);
    return row;
  });
}

export async function rejectIdentityRequestAction(requestId: string, input: unknown) {
  return masterAction(async (ctx) => {
    const row = await rejectRequest(ctx.userId, requestId, input);
    revalidatePath(QUEUE_PATH);
    return row;
  });
}

export async function revokeIdentityVerificationAction(
  verificationId: string,
  input: unknown,
) {
  return masterAction(async (ctx) => {
    const row = await revokeVerification(ctx.userId, verificationId, input);
    revalidatePath(QUEUE_PATH);
    return row;
  });
}
