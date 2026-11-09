import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/pcmso-documents";
import { todayInSaoPaulo } from "@/shared/dates";
import { checkSignedPdf } from "@/shared/domains/medicine/aso-signed";
import {
  pcmsoSignedInputSchema,
  pcmsoSignedOnProblem,
  pcmsoSignedWarnings,
} from "@/shared/domains/medicine/pcmso-signed";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { ValidationError } from "@/shared/errors/validation-error";
import {
  getSignedDownloadUrl,
  putSignedAsoObject as putPrivatePdf,
  removeDocumentObject,
  SIGNED_DOWNLOAD_URL_TTL_SECONDS,
  signedPcmsoPath,
} from "@/shared/integrations/storage/documents-storage";

const companyUuid = (id: string) => requiredUuid("Empresa inválida.").parse(id);

/** Campos do formulário multipart (o PDF vem à parte, em `file`). */
export function signedPcmsoFields(form: FormData) {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return {
    origin: text("origin"),
    previewDocumentId: text("previewDocumentId"),
    signatureMethod: text("signatureMethod"),
    verificationReference: text("verificationReference"),
    signerName: text("signerName"),
    signerRegistration: text("signerRegistration"),
    signerUf: text("signerUf"),
    signedOn: text("signedOn"),
    replacesId: text("replacesId"),
    changeKind: text("changeKind"),
    replaceReason: text("replaceReason") || undefined,
  };
}

/** PCMSOs assinados da empresa, o vigente e os alertas de desatualização. */
export async function listSignedPcmsos(ctx: TenantContext, companyId: string) {
  const data = await repo.listSignedPcmsos(ctx, companyUuid(companyId));
  // Legado com mais de uma vigente (anterior à 0082): nenhuma é escolhida (falha fechada).
  const currents = data.items.filter((item) => item.replacedById === null);
  const ambiguous = currents.length > 1;
  const current = currents.length === 1 ? currents[0] : null;
  return {
    items: data.items,
    currentId: current?.id ?? null,
    warnings: [
      ...(ambiguous ? (["signed_current_ambiguous"] as const) : []),
      ...(data.riskBasisChanged && current ? (["risk_basis_changed"] as const) : []),
      ...pcmsoSignedWarnings({
        current: current
          ? { ...current, previewCoordinator: data.currentPreviewCoordinator }
          : null,
        latestPreviewVersion: data.latestPreviewVersion,
        approvedPlanId: data.approvedPlanId,
        coordinator: data.coordinator,
        today: todayInSaoPaulo(),
      }),
    ],
  };
}

/**
 * Registra o PCMSO assinado (NOB-166): valida os campos e o PDF, calcula o SHA-256 no servidor,
 * grava no caminho do tenant e registra; se o registro falhar, o arquivo é removido. O sistema não
 * assina e não valida a assinatura criptograficamente: guarda a conferência documental informada.
 */
export async function registerSignedPcmso(
  ctx: TenantContext,
  companyId: string,
  fields: unknown,
  file: File | null,
) {
  const id = companyUuid(companyId);
  const input = pcmsoSignedInputSchema.parse(fields);
  if (!file) throw new ValidationError("Envie o PDF assinado.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkSignedPdf(bytes);
  if (!check.ok) throw new ValidationError(check.message);
  const recordId = randomUUID();
  const storagePath = signedPcmsoPath(ctx.tenantId, id, recordId);
  const today = todayInSaoPaulo();
  await putPrivatePdf(storagePath, bytes);
  try {
    return await repo.insertSignedPcmso(
      ctx,
      id,
      input,
      {
        id: recordId,
        storagePath,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        sizeBytes: bytes.byteLength,
      },
      (facts) => pcmsoSignedOnProblem({ signedOn: input.signedOn, today, ...facts }),
    );
  } catch (error) {
    try {
      await removeDocumentObject(storagePath);
    } catch {
      // Arquivo órfão sem registro não é servido (o download parte do registro).
    }
    throw error;
  }
}

/** URL assinada curta do PDF; o caminho sai do registro do tenant, nunca do cliente. */
export async function signedPcmsoDownload(ctx: TenantContext, id: string) {
  const row = await repo.getSignedPcmso(
    ctx,
    requiredUuid("Documento inválido.").parse(id),
  );
  const url = await getSignedDownloadUrl(row.storagePath, {
    downloadName: `pcmso-assinado-${row.signedOn}.pdf`,
  });
  return {
    url,
    expiresInSeconds: SIGNED_DOWNLOAD_URL_TTL_SECONDS,
    sha256: row.fileSha256,
  };
}
