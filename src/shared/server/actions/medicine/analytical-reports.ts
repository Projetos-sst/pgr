"use server";
import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import {
  generateReport,
  getReport,
  getReportContext,
  listReports,
} from "@/shared/server/medicine/analytical-report-core";

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
