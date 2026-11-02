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
