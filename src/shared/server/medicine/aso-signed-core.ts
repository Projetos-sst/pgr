import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/aso";
import { todayInSaoPaulo } from "@/shared/dates";
import {
  asoSignedInputSchema,
  checkSignedPdf,
  currentSignedAso,
  signedAsoOutdated,
  signedOnProblem,
} from "@/shared/domains/medicine/aso-signed";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { ValidationError } from "@/shared/errors/validation-error";
import {
  getSignedDownloadUrl,
  putSignedAsoObject,
  removeDocumentObject,
  SIGNED_DOWNLOAD_URL_TTL_SECONDS,
  signedAsoPath,
} from "@/shared/integrations/storage/documents-storage";

import { currentAsoComposition } from "./aso-core";

const examUuid = (id: string) => requiredUuid("Exame inválido.").parse(id);

/** Campos do formulário multipart (o arquivo vem à parte). */
export function signedAsoFields(form: FormData) {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    origin: text("origin"),
    previewDocumentId: text("previewDocumentId"),
    signatureMethod: text("signatureMethod"),
    verificationReference: text("verificationReference"),
    signerName: text("signerName"),
    signerRegistration: text("signerRegistration"),
    signerUf: text("signerUf"),
    conclusion: text("conclusion"),
    signedOn: text("signedOn"),
    replacesId: text("replacesId"),
    replaceReason: text("replaceReason"),
  };
}

/**
 * Registra o ASO assinado (NOB-163). Ordem: valida os campos e o PDF, calcula o SHA-256 no servidor,
 * grava o arquivo no caminho do tenant da sessão e registra; se o registro falhar, o arquivo é
 * removido (compensação). O sistema não assina: guarda o documento, o método e a conferência.
 */
export async function registerSignedAso(
  ctx: TenantContext,
  examId: string,
  fields: unknown,
  file: File | null,
) {
  const id = examUuid(examId);
  const input = asoSignedInputSchema.parse(fields);
  if (!file) throw new ValidationError("Envie o PDF assinado.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkSignedPdf(bytes);
  if (!check.ok) throw new ValidationError(check.message);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const recordId = randomUUID();
  const storagePath = signedAsoPath(ctx.tenantId, id, recordId);
  const today = todayInSaoPaulo();

  // Fluxo A: a prévia assinada precisa ser a mais recente e ainda a composição atual do exame.
  // A conferência roda no registro, com o exame travado e DEPOIS da autorização do examinador
  // (quem não pode registrar recebe FORBIDDEN, não um erro de validação); se falhar, o arquivo
  // enviado é removido pela compensação abaixo.
  const currentPreviewSha256 =
    input.origin === "examiner"
      ? (await currentAsoComposition(ctx, id)).contentSha256
      : null;

  await putSignedAsoObject(storagePath, bytes);
  try {
    return await repo.insertSignedAso(
      ctx,
      id,
      input,
      { id: recordId, storagePath, sha256, sizeBytes: bytes.byteLength },
      (performedAt) => signedOnProblem(input.signedOn, performedAt, today),
      currentPreviewSha256,
    );
  } catch (error) {
    try {
      await removeDocumentObject(storagePath);
    } catch {
      // Arquivo órfão sem registro não é servido (o download parte do registro); segue o erro original.
    }
    throw error;
  }
}

/**
 * ASOs assinados do exame. O vigente leva `outdated` (MED-11): o exame mudou depois da assinatura
 * (fluxo A: prévia assinada ≠ composição atual; fluxo B: conclusão ≠ a do exame). Só avisa: a
 * edição do exame segue livre, e a correção é a substituição a partir de nova prévia.
 */
export async function listSignedAsos(ctx: TenantContext, examId: string) {
  const id = examUuid(examId);
  const items = await repo.listSignedAsos(ctx, id);
  const current = currentSignedAso(items);
  if (!current) return items;
  const composition = await currentAsoComposition(ctx, id);
  const previews = current.previewDocumentId ? await repo.listAsoDocuments(ctx, id) : [];
  const signedPreview = previews.find((doc) => doc.id === current.previewDocumentId);
  const outdated = signedAsoOutdated(current, {
    previewSha256: signedPreview?.contentSha256 ?? null,
    currentSha256: composition.contentSha256,
    conclusion: composition.conclusion,
  });
  return items.map((item) => (item.id === current.id ? { ...item, outdated } : item));
}

/** URL assinada curta para baixar o PDF; o caminho sai do registro do tenant, nunca do cliente. */
export async function signedAsoDownload(ctx: TenantContext, id: string) {
  const row = await repo.getSignedAso(ctx, requiredUuid("Documento inválido.").parse(id));
  const url = await getSignedDownloadUrl(row.storagePath, {
    downloadName: `aso-assinado-${row.signedOn}.pdf`,
  });
  return {
    url,
    expiresInSeconds: SIGNED_DOWNLOAD_URL_TTL_SECONDS,
    sha256: row.fileSha256,
  };
}
