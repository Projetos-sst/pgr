"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  generateDocument,
  getDocument,
  listDocuments,
} from "@/shared/server/medicine/pcmso-document-core";

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
