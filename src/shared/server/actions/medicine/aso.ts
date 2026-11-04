"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  addProcedure,
  confirmCompanyOrigin,
  confirmExaminerConclusion,
  listExaminerConclusions,
  generateDocument,
  getAsoReadiness,
  getDocument,
  listDocuments,
  listProcedures,
  removeProcedure,
} from "@/shared/server/medicine/aso-core";
import {
  listSignedAsos,
  registerSignedAso,
  signedAsoDownload,
  signedAsoFields,
} from "@/shared/server/medicine/aso-signed-core";
import {
  asoDeliveryFields,
  deliveryEvidenceDownload,
  listDeliveries,
  registerDelivery,
  voidDelivery,
} from "@/shared/server/medicine/aso-delivery-core";

const asoPath = (examId: string) => `/health-exams/${examId}/aso`;

export async function getAsoReadinessAction(examId: string) {
  return officeAction("medicine.aso.readiness", (ctx) => getAsoReadiness(ctx, examId));
}

export async function listExamProceduresAction(examId: string) {
  return officeAction("medicine.exam_procedures.list", (ctx) =>
    listProcedures(ctx, examId),
  );
}

export async function addExamProcedureAction(examId: string, input: unknown) {
  return officeAction(
    "medicine.exam_procedures.add",
    async (ctx) => {
      const row = await addProcedure(ctx, examId, input);
      revalidatePath(asoPath(examId));
      return row;
    },
    { audit: true },
  );
}

export async function removeExamProcedureAction(examId: string, procedureId: string) {
  return officeAction(
    "medicine.exam_procedures.remove",
    async (ctx) => {
      await removeProcedure(ctx, examId, procedureId);
      revalidatePath(asoPath(examId));
    },
    { audit: true },
  );
}

export async function listAsoDocumentsAction(examId: string) {
  return officeAction("medicine.aso_documents.list", (ctx) => listDocuments(ctx, examId));
}

export async function getAsoDocumentAction(id: string) {
  return officeAction("medicine.aso_documents.get", (ctx) => getDocument(ctx, id));
}

export async function generateAsoDocumentAction(examId: string) {
  return officeAction(
    "medicine.aso_documents.generate",
    async (ctx) => {
      const doc = await generateDocument(ctx, examId);
      revalidatePath(asoPath(examId));
      return doc;
    },
    { audit: true },
  );
}

export async function confirmExamCompanyOriginAction(examId: string, input: unknown) {
  return officeAction(
    "medicine.exam_origin.confirm",
    async (ctx) => {
      const row = await confirmCompanyOrigin(ctx, examId, input);
      revalidatePath(asoPath(examId));
      return row;
    },
    { audit: true },
  );
}

export async function listExaminerConclusionsAction(examId: string) {
  return officeAction("medicine.aso_examiner_conclusions.list", (ctx) =>
    listExaminerConclusions(ctx, examId),
  );
}

export async function confirmExaminerConclusionAction(examId: string, input: unknown) {
  return officeAction(
    "medicine.aso_examiner_conclusions.confirm",
    async (ctx) => {
      const row = await confirmExaminerConclusion(ctx, examId, input);
      revalidatePath(asoPath(examId));
      return row;
    },
    { audit: true },
  );
}

// ── ASO assinado arquivado (NOB-163) ─────────────────────────────────────────

export async function listSignedAsosAction(examId: string) {
  return officeAction("medicine.aso_signed.list", (ctx) => listSignedAsos(ctx, examId));
}

/** FormData: `file` (PDF assinado) + campos de `asoSignedInputSchema`. */
export async function registerSignedAsoAction(examId: string, form: FormData) {
  return officeAction(
    "medicine.aso_signed.register",
    async (ctx) => {
      const raw = form.get("file");
      const row = await registerSignedAso(
        ctx,
        examId,
        signedAsoFields(form),
        raw instanceof File ? raw : null,
      );
      revalidatePath(asoPath(examId));
      return row;
    },
    { audit: true },
  );
}

export async function getSignedAsoDownloadAction(id: string) {
  return officeAction("medicine.aso_signed.download", (ctx) =>
    signedAsoDownload(ctx, id),
  );
}

// ── Entrega do ASO ao trabalhador (NOB-165) ──────────────────────────────────

export async function listAsoDeliveriesAction(examId: string) {
  return officeAction("medicine.aso_delivery.list", (ctx) => listDeliveries(ctx, examId));
}

/** FormData: kind, method?, channelDescription?, occurredAt, evidenceReference?, evidenceKind?, evidence? */
export async function registerAsoDeliveryAction(examId: string, form: FormData) {
  return officeAction(
    "medicine.aso_delivery.register",
    async (ctx) => {
      const raw = form.get("evidence");
      const row = await registerDelivery(
        ctx,
        examId,
        asoDeliveryFields(form),
        raw instanceof File ? raw : null,
      );
      revalidatePath(asoPath(examId));
      return row;
    },
    { audit: true },
  );
}

export async function voidAsoDeliveryAction(
  examId: string,
  deliveryId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.aso_delivery.void",
    async (ctx) => {
      const row = await voidDelivery(ctx, examId, deliveryId, input);
      revalidatePath(asoPath(examId));
      return row;
    },
    { audit: true },
  );
}

export async function getAsoDeliveryEvidenceAction(id: string) {
  return officeAction("medicine.aso_delivery.evidence", (ctx) =>
    deliveryEvidenceDownload(ctx, id),
  );
}
