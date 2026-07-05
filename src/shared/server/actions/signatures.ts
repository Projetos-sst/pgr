"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  createSignatureRequestSchema,
  signManuallySchema,
  type CreateSignatureRequestInput,
  type SignManuallyInput,
} from "@/shared/domains/signatures/schemas";
import { getPayloadSchema } from "@/shared/domains/signatures/contract";
import {
  computeExpiresAt,
  generateToken,
  hashToken,
  isExpired,
} from "@/shared/domains/signatures/token";
import { buildPublicSignatureUrl } from "@/shared/domains/signatures/public-url";
import type { SignatureStatusView } from "@/shared/domains/signatures/types";
import { FREE_SIGNATURE_MONTHLY_QUOTA, isSignatureAvailable } from "@/shared/tenant/plan";
import { QuotaExceededError } from "@/shared/errors/quota-exceeded-error";
import * as repo from "@/shared/db/repositories/signature-requests";

const BASE_PATH = "/signatures";

export type CreateSignatureRequestResult = {
  requestId: string;
  publicUrl: string;
  qrCodeDataUrl: string;
};

export async function createSignatureRequest(
  input: CreateSignatureRequestInput,
): Promise<ActionResult<CreateSignatureRequestResult>> {
  return officeAction(
    "signatures.create",
    async ({ tenantId, plan }) => {
      const data = createSignatureRequestSchema.parse(input);
      const payload = getPayloadSchema(data.targetType).parse(data.payload);

      // Gate de plano (FR-019/020): plano do tenant ativo; free limitado, pro ilimitado.
      const monthlyCount = await repo.countRequestsInCurrentMonth(tenantId);
      if (!isSignatureAvailable(plan, monthlyCount)) {
        throw new QuotaExceededError(
          `Limite de ${FREE_SIGNATURE_MONTHLY_QUOTA} assinaturas/mês do plano free atingido.`,
        );
      }

      const rawToken = generateToken();
      const { id } = await repo.createRequest(tenantId, {
        targetType: data.targetType,
        targetId: data.targetId,
        tokenHash: hashToken(rawToken),
        payload,
        expiresAt: computeExpiresAt(data.ttlSeconds),
      });

      const publicUrl = buildPublicSignatureUrl(rawToken);
      const qrCodeDataUrl = await QRCode.toDataURL(publicUrl);
      revalidatePath(BASE_PATH);
      return { requestId: id, publicUrl, qrCodeDataUrl };
    },
    { audit: true },
  );
}

export type SignatureStatusResult = {
  status: SignatureStatusView;
  signedAt?: string;
};

export async function getSignatureStatus(
  requestId: string,
): Promise<ActionResult<SignatureStatusResult>> {
  return officeAction("signatures.get_status", async ({ tenantId }) => {
    const row = await repo.getRequestStatusById(tenantId, requestId);
    if (!row) throw new NotFoundError();
    const status: SignatureStatusView = isExpired(row.expiresAt, row.status)
      ? "expired"
      : row.status;
    return { status, signedAt: row.signedAt?.toISOString() };
  });
}

export async function signManually(
  requestId: string,
  input: SignManuallyInput,
): Promise<ActionResult<void>> {
  return officeAction(
    "signatures.sign_manually",
    async ({ tenantId }) => {
      const data = signManuallySchema.parse(input);
      const done = await repo.signManually(tenantId, {
        requestId,
        signerName: data.signerName,
      });
      if (!done) throw new NotFoundError();
      revalidatePath(BASE_PATH);
    },
    { audit: true },
  );
}
