import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { SignatureMethodValue } from "@/shared/domains/signatures/types";

import { withOrg } from "../with-org";
import { withSignatureToken } from "../with-signature-token";
import {
  signatureRequests,
  signatureCaptures,
  type SignatureRequest,
} from "../schema/signatures";
import { auditedTenantWrite } from "./audited-write";

const AUDIT_OP = "signatures.write_rejected";

export type CreateRequestInput = {
  targetType: string;
  targetId?: string;
  tokenHash: string;
  payload: unknown;
  expiresAt: Date;
};

export async function createRequest(
  orgId: string,
  input: CreateRequestInput,
): Promise<{ id: string }> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
        .insert(signatureRequests)
        .values({
          orgId,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          tokenHash: input.tokenHash,
          payload: input.payload,
          expiresAt: input.expiresAt,
        })
        .returning({ id: signatureRequests.id });
      return row;
    }),
  );
}

/** Contagem derivada por mês corrente (gate de quota free). Sem contador/cron. */
export async function countRequestsInCurrentMonth(orgId: string): Promise<number> {
  return withOrg(orgId, async (tx) => {
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(signatureRequests)
      .where(
        and(
          eq(signatureRequests.orgId, orgId),
          sql`${signatureRequests.createdAt} >= date_trunc('month', now())`,
        ),
      );
    return total;
  });
}

export type RequestStatusRow = {
  status: SignatureRequest["status"];
  expiresAt: Date;
  signedAt: Date | null;
};

export type LatestRequestRow = {
  id: string;
  status: SignatureRequest["status"];
  expiresAt: Date;
  signedAt: Date | null;
  signerName: string | null;
};

/**
 * Solicitação mais recente de um alvo (`target_type`+`target_id`) no tenant. Servida pelo índice
 * `idx_signature_requests_target`. Leitura → sem `auditedTenantWrite`. **Nunca** devolve token/hash.
 */
export async function getLatestRequestByTarget(
  orgId: string,
  targetType: string,
  targetId: string,
): Promise<LatestRequestRow | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        id: signatureRequests.id,
        status: signatureRequests.status,
        expiresAt: signatureRequests.expiresAt,
        signedAt: signatureCaptures.signedAt,
        signerName: signatureCaptures.signerName,
      })
      .from(signatureRequests)
      .leftJoin(signatureCaptures, eq(signatureCaptures.requestId, signatureRequests.id))
      .where(
        and(
          eq(signatureRequests.orgId, orgId),
          eq(signatureRequests.targetType, targetType),
          eq(signatureRequests.targetId, targetId),
        ),
      )
      .orderBy(desc(signatureRequests.createdAt))
      .limit(1);
    return row ?? null;
  });
}

export async function getRequestStatusById(
  orgId: string,
  id: string,
): Promise<RequestStatusRow | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        status: signatureRequests.status,
        expiresAt: signatureRequests.expiresAt,
        signedAt: signatureCaptures.signedAt,
      })
      .from(signatureRequests)
      .leftJoin(signatureCaptures, eq(signatureCaptures.requestId, signatureRequests.id))
      .where(and(eq(signatureRequests.orgId, orgId), eq(signatureRequests.id, id)))
      .limit(1);
    return row ?? null;
  });
}

/**
 * Leitura pública via policy de capability: retorna a única linha cujo token o
 * cliente possui (ou null). O tenant é derivado daqui (`org_id`), nunca do cliente.
 */
export async function getRequestByToken(
  rawToken: string,
): Promise<SignatureRequest | null> {
  return withSignatureToken(rawToken, async (tx) => {
    const [row] = await tx.select().from(signatureRequests).limit(1);
    return row ?? null;
  });
}

type CaptureInput = {
  requestId: string;
  imageData: string;
  signerName: string;
  method: SignatureMethodValue;
};

/**
 * Consome o token (UPDATE atômico `WHERE used_at IS NULL` — guarda de uso único /
 * corrida) e grava a captura 1:1. Retorna false se o pedido já foi usado/não existe
 * no tenant. Roda em `withOrg(orgId)` (policy de tenant) após o token resolver o org.
 */
export async function consumeAndCapture(
  orgId: string,
  input: CaptureInput,
): Promise<boolean> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const consumed = await tx
        .update(signatureRequests)
        .set({ status: "signed", usedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(signatureRequests.orgId, orgId),
            eq(signatureRequests.id, input.requestId),
            isNull(signatureRequests.usedAt),
          ),
        )
        .returning({ id: signatureRequests.id });
      if (consumed.length === 0) return false;
      await tx.insert(signatureCaptures).values({
        orgId,
        requestId: input.requestId,
        imageData: input.imageData,
        signerName: input.signerName,
        method: input.method,
      });
      return true;
    }),
  );
}

export type ManualCaptureInput = { requestId: string; signerName: string };

/** Assinatura manual (fallback interno). Mesma guarda de uso único. */
export async function signManually(
  orgId: string,
  input: ManualCaptureInput,
): Promise<boolean> {
  return consumeAndCapture(orgId, {
    requestId: input.requestId,
    imageData: MANUAL_CAPTURE_SENTINEL,
    signerName: input.signerName,
    method: "manual",
  });
}

/** Sentinela para captura manual (sem imagem digital). */
export const MANUAL_CAPTURE_SENTINEL = "manual:no-image";
