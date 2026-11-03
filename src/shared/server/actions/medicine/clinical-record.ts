"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  addClinicalNote,
  getClinicalAccess,
  listClinicalAccessEvents,
  listWorkRestrictions,
  readClinicalRecord,
  recordWorkRestriction,
} from "@/shared/server/medicine/clinical-record-core";

const recordPath = (examId: string) => `/health-exams/${examId}/clinical-record`;

export async function getClinicalAccessAction(examId: string) {
  return officeAction("medicine.clinical_record.access", (ctx) =>
    getClinicalAccess(ctx, examId),
  );
}

// A leitura do prontuário é auditada no banco (clinical_record_access_events).
export async function readClinicalRecordAction(examId: string) {
  return officeAction(
    "medicine.clinical_record.read",
    (ctx) => readClinicalRecord(ctx, examId),
    { audit: true },
  );
}

export async function addClinicalNoteAction(examId: string, input: unknown) {
  return officeAction(
    "medicine.clinical_notes.add",
    async (ctx) => {
      const row = await addClinicalNote(ctx, examId, input);
      revalidatePath(recordPath(examId));
      return row;
    },
    { audit: true },
  );
}

export async function listWorkRestrictionsAction(examId: string) {
  return officeAction("medicine.work_restrictions.list", (ctx) =>
    listWorkRestrictions(ctx, examId),
  );
}

export async function recordWorkRestrictionAction(examId: string, input: unknown) {
  return officeAction(
    "medicine.work_restrictions.record",
    async (ctx) => {
      const row = await recordWorkRestriction(ctx, examId, input);
      revalidatePath(recordPath(examId));
      revalidatePath(`/health-exams/${examId}/edit`);
      return row;
    },
    { audit: true },
  );
}

export async function listClinicalAccessEventsAction(examId: string) {
  return officeAction("medicine.clinical_record.access_events", (ctx) =>
    listClinicalAccessEvents(ctx, examId),
  );
}
