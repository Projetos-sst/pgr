import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/aso";
import {
  ASO_DELIVERY_EVIDENCE_KINDS,
  asoDeliveryInputSchema,
  asoDeliveryVoidSchema,
  asoEvidenceReviewSchema,
  checkDeliveryEvidence,
  EVIDENCE_EXTENSIONS,
  occurredAtProblem,
  summarizeDelivery,
  type AsoDeliveryEvidenceKindValue,
} from "@/shared/domains/medicine/aso-delivery";
import { currentSignedAso } from "@/shared/domains/medicine/aso-signed";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { ValidationError } from "@/shared/errors/validation-error";
import {
  asoDeliveryEvidencePath,
  getSignedDownloadUrl,
  putAsoDeliveryEvidence,
  removeDocumentObject,
  SIGNED_DOWNLOAD_URL_TTL_SECONDS,
} from "@/shared/integrations/storage/documents-storage";

const examUuid = (id: string) => requiredUuid("Exame inválido.").parse(id);

/** Campos do formulário multipart (o comprovante vem à parte, em `evidence`). */
export function asoDeliveryFields(form: FormData) {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  return {
    kind: text("kind"),
    method: text("method"),
    channelDescription: text("channelDescription"),
    occurredAt: text("occurredAt") ?? "",
    evidenceReference: text("evidenceReference"),
    evidenceKind: text("evidenceKind"),
  };
}

/**
 * Entregas do exame e a situação da entrega do ASO vigente (registrada, comprovada ou com ciência
 * confirmada), com aviso de via física pendente e de substituição que exige nova entrega.
 */
export async function listDeliveries(ctx: TenantContext, examId: string) {
  const { deliveries, signed } = await repo.listAsoDeliveries(ctx, examUuid(examId));
  const current = currentSignedAso(signed);
  return {
    currentSignedDocumentId: current?.id ?? null,
    summary: summarizeDelivery(deliveries, current?.id ?? null),
    deliveries,
  };
}

/**
 * Registra a entrega (ou o pedido de via física) do ASO assinado vigente. Com comprovante: o tipo é
 * conferido pelos bytes, o SHA-256 é calculado no servidor e o arquivo vai para o caminho do tenant;
 * se o registro falhar, o arquivo é removido. Sem comprovante, a entrega fica só "registrada".
 */
export async function registerDelivery(
  ctx: TenantContext,
  examId: string,
  fields: unknown,
  evidenceFile: File | null,
) {
  const id = examUuid(examId);
  const input = asoDeliveryInputSchema.parse(fields);
  const recordId = randomUUID();
  let evidence: repo.AsoDeliveryEvidenceFile | null = null;
  if (evidenceFile && evidenceFile.size > 0) {
    if (input.kind !== "made_available")
      throw new ValidationError("Comprovante só acompanha uma entrega.");
    const kind = input.evidenceKind as AsoDeliveryEvidenceKindValue | undefined;
    if (!kind || !ASO_DELIVERY_EVIDENCE_KINDS.includes(kind))
      throw new ValidationError("Informe o tipo do comprovante anexado.");
    const bytes = new Uint8Array(await evidenceFile.arrayBuffer());
    const check = checkDeliveryEvidence(bytes);
    if (!check.ok) throw new ValidationError(check.message);
    const path = asoDeliveryEvidencePath(
      ctx.tenantId,
      id,
      recordId,
      EVIDENCE_EXTENSIONS[check.contentType],
    );
    await putAsoDeliveryEvidence(path, bytes, check.contentType);
    evidence = {
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.byteLength,
      contentType: check.contentType,
      kind,
    };
  } else if (input.evidenceKind) {
    throw new ValidationError(
      "Tipo de comprovante informado sem arquivo: anexe o comprovante ou deixe o tipo em branco.",
    );
  }
  const now = new Date();
  try {
    return await repo.insertAsoDelivery(ctx, id, recordId, input, evidence, (signedOn) =>
      occurredAtProblem(input.occurredAt, signedOn, now),
    );
  } catch (error) {
    if (evidence)
      try {
        await removeDocumentObject(evidence.path);
      } catch {
        // Arquivo órfão sem registro não é servido (o download parte do registro).
      }
    throw error;
  }
}

/** Corrige um registro anterior, com motivo (append-only). */
export async function voidDelivery(
  ctx: TenantContext,
  examId: string,
  deliveryId: string,
  input: unknown,
) {
  const { reason } = asoDeliveryVoidSchema.parse(input);
  return repo.voidAsoDelivery(
    ctx,
    examUuid(examId),
    requiredUuid("Registro inválido.").parse(deliveryId),
    reason,
    randomUUID(),
  );
}

/** URL assinada curta do comprovante; o caminho sai do registro do tenant, nunca do cliente. */
export async function deliveryEvidenceDownload(ctx: TenantContext, id: string) {
  const row = await repo.getAsoDelivery(
    ctx,
    requiredUuid("Registro inválido.").parse(id),
  );
  if (!row.evidencePath || !row.evidenceContentType)
    throw new ValidationError("Este registro não tem comprovante anexado.");
  const ext =
    EVIDENCE_EXTENSIONS[row.evidenceContentType as keyof typeof EVIDENCE_EXTENSIONS];
  const url = await getSignedDownloadUrl(row.evidencePath, {
    downloadName: `comprovante-entrega-aso.${ext}`,
  });
  return {
    url,
    expiresInSeconds: SIGNED_DOWNLOAD_URL_TTL_SECONDS,
    sha256: row.evidenceSha256,
  };
}

/** Conferência humana do comprovante, com método, resultado e referência (NOB-167). */
export async function reviewDeliveryEvidence(
  ctx: TenantContext,
  examId: string,
  deliveryId: string,
  input: unknown,
) {
  const values = asoEvidenceReviewSchema.parse(input);
  return repo.insertAsoEvidenceReview(
    ctx,
    examUuid(examId),
    requiredUuid("Registro inválido.").parse(deliveryId),
    values,
    randomUUID(),
  );
}
