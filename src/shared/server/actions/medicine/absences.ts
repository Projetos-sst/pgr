"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  addClinicalNote,
  cancelAbsence,
  canAccessClinical,
  confirmReturn,
  createAbsence,
  getAbsence,
  listAbsences,
  readClinicalNotes,
  updateAbsenceEnd,
} from "@/shared/server/medicine/absence-core";

const employeePath = (employeeId: string) => `/employees/${employeeId}`;

export async function listAbsencesAction(employeeId: string) {
  return officeAction("medicine.absences.list", (ctx) => listAbsences(ctx, employeeId));
}

export async function getAbsenceAction(id: string) {
  return officeAction("medicine.absences.get", (ctx) => getAbsence(ctx, id));
}

export async function createAbsenceAction(employeeId: string, input: unknown) {
  return officeAction(
    "medicine.absences.create",
    async (ctx) => {
      const row = await createAbsence(ctx, employeeId, input);
      revalidatePath(employeePath(employeeId));
      return row;
    },
    { audit: true },
  );
}

export async function updateAbsenceEndAction(id: string, input: unknown) {
  return officeAction(
    "medicine.absences.update_end",
    async (ctx) => {
      const row = await updateAbsenceEnd(ctx, id, input);
      revalidatePath(employeePath(row.employeeId));
      return row;
    },
    { audit: true },
  );
}

export async function confirmAbsenceReturnAction(id: string, input: unknown) {
  return officeAction(
    "medicine.absences.return",
    async (ctx) => {
      const row = await confirmReturn(ctx, id, input);
      revalidatePath(employeePath(row.employeeId));
      return row;
    },
    { audit: true },
  );
}

export async function cancelAbsenceAction(id: string, input: unknown) {
  return officeAction(
    "medicine.absences.cancel",
    async (ctx) => {
      const row = await cancelAbsence(ctx, id, input);
      revalidatePath(employeePath(row.employeeId));
      return row;
    },
    { audit: true },
  );
}

// A leitura da área clínica é auditada no banco (absence_clinical_access_events).
export async function readAbsenceClinicalNotesAction(id: string) {
  return officeAction(
    "medicine.absence_clinical.read",
    (ctx) => readClinicalNotes(ctx, id),
    { audit: true },
  );
}

export async function addAbsenceClinicalNoteAction(id: string, input: unknown) {
  return officeAction(
    "medicine.absence_clinical.add",
    async (ctx) => {
      const row = await addClinicalNote(ctx, id, input);
      revalidatePath(`/absences/${id}/clinical`);
      return row;
    },
    { audit: true },
  );
}

export async function canAccessAbsenceClinicalAction(id: string) {
  return officeAction("medicine.absence_clinical.access", (ctx) =>
    canAccessClinical(ctx, id),
  );
}
