"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/shared/errors/not-found-error";
import { ValidationError } from "@/shared/errors/validation-error";
import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  createSignatureRequestSchema,
  signManuallySchema,
  type CreateSignatureRequestInput,
  type SignManuallyInput,
} from "@/shared/domains/signatures/schemas";
import { isExpired } from "@/shared/domains/signatures/token";
import type { SignatureStatusView } from "@/shared/domains/signatures/types";
import { createSignatureRequestCore } from "@/shared/server/signatures/create-request-core";
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
    async (ctx) => {
      const data = createSignatureRequestSchema.parse(input);
      if (data.targetType === "pgr")
        throw new ValidationError(
          "Crie a solicitação pela tela do documento para usar os dados e as permissões conferidos no servidor.",
        );
      // Cota, token, hash, TTL, persistência e URL vivem no núcleo compartilhado (regra única).
      const result = await createSignatureRequestCore(ctx, {
        targetType: data.targetType,
        targetId: data.targetId,
        payload: data.payload,
        ttlSeconds: data.ttlSeconds,
      });
      revalidatePath(BASE_PATH);
      return result;
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
