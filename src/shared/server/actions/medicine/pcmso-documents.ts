"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  generateDocument,
  getDocument,
  listDocuments,
} from "@/shared/server/medicine/pcmso-document-core";
import {
  listSignedPcmsos,
  registerSignedPcmso,
  signedPcmsoDownload,
  signedPcmsoFields,
} from "@/shared/server/medicine/pcmso-signed-core";

export async function listPcmsoDocumentsAction(companyId: string) {
  return officeAction("medicine.pcmso_documents.list", (ctx) =>
    listDocuments(ctx, companyId),
  );
}

export async function getPcmsoDocumentAction(id: string) {
  return officeAction("medicine.pcmso_documents.get", (ctx) => getDocument(ctx, id));
}

export async function generatePcmsoDocumentAction(companyId: string, input: unknown) {
  return officeAction(
    "medicine.pcmso_documents.generate",
    async (ctx) => {
      const doc = await generateDocument(ctx, companyId, input);
      revalidatePath(`/companies/${companyId}/pcmso`);
      return doc;
    },
    { audit: true },
  );
}

// ── PCMSO assinado arquivado (NOB-166) ───────────────────────────────────────

export async function listSignedPcmsosAction(companyId: string) {
  return officeAction("medicine.pcmso_signed.list", (ctx) =>
    listSignedPcmsos(ctx, companyId),
  );
}

/** FormData: `file` (PDF assinado) + campos de `pcmsoSignedInputSchema`. */
export async function registerSignedPcmsoAction(companyId: string, form: FormData) {
  return officeAction(
    "medicine.pcmso_signed.register",
    async (ctx) => {
      const raw = form.get("file");
      const row = await registerSignedPcmso(
        ctx,
        companyId,
        signedPcmsoFields(form),
        raw instanceof File ? raw : null,
      );
      revalidatePath(`/companies/${companyId}/pcmso`);
      return row;
    },
    { audit: true },
  );
}

export async function getSignedPcmsoDownloadAction(id: string) {
  return officeAction("medicine.pcmso_signed.download", (ctx) =>
    signedPcmsoDownload(ctx, id),
  );
}
