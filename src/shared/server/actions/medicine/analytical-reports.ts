"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  generateReport,
  getReport,
  getReportContext,
  listReports,
} from "@/shared/server/medicine/analytical-report-core";
import {
  listReportPresentation,
  registerReportEvent,
  voidReportEvent,
} from "@/shared/server/medicine/analytical-report-presentation-core";

export async function listAnalyticalReportsAction(companyId: string) {
  return officeAction("medicine.analytical_reports.list", (ctx) =>
    listReports(ctx, companyId),
  );
}

export async function getAnalyticalReportAction(id: string) {
  return officeAction("medicine.analytical_reports.get", (ctx) => getReport(ctx, id));
}

export async function getAnalyticalReportContextAction(
  companyId: string,
  period?: unknown,
) {
  return officeAction("medicine.analytical_reports.context", (ctx) =>
    getReportContext(ctx, companyId, period),
  );
}

export async function generateAnalyticalReportAction(companyId: string, input: unknown) {
  return officeAction(
    "medicine.analytical_reports.generate",
    async (ctx) => {
      const report = await generateReport(ctx, companyId, input);
      revalidatePath(`/companies/${companyId}/analytical-report`);
      return report;
    },
    { audit: true },
  );
}

// ── Finalização, apresentação e discussão (NOB-168) ──────────────────────────

export async function listReportPresentationAction(companyId: string) {
  return officeAction("medicine.analytical_report_events.list", (ctx) =>
    listReportPresentation(ctx, companyId),
  );
}

/** { kind: "finalized" | "presented" | "discussed", ... } para a versão vigente do relatório. */
export async function registerReportEventAction(
  companyId: string,
  reportId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.analytical_report_events.register",
    async (ctx) => {
      const row = await registerReportEvent(ctx, reportId, input);
      revalidatePath(`/companies/${companyId}/analytical-report`);
      return row;
    },
    { audit: true },
  );
}

export async function voidReportEventAction(
  companyId: string,
  eventId: string,
  input: unknown,
) {
  return officeAction(
    "medicine.analytical_report_events.void",
    async (ctx) => {
      const row = await voidReportEvent(ctx, eventId, input);
      revalidatePath(`/companies/${companyId}/analytical-report`);
      return row;
    },
    { audit: true },
  );
}
