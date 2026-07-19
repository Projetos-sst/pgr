import "server-only";

import * as dashboardRepo from "@/shared/db/repositories/dashboard";
import { listEsocialEventsForReport } from "@/shared/db/repositories/esocial-events";
import {
  buildEsocialEventsHtml,
  buildOnboardingManualHtml,
  buildOrgSummaryHtml,
  findReportType,
} from "@/shared/domains/platform/reports";
import { NotFoundError } from "@/shared/errors/not-found-error";
import { ReportUnavailableError } from "@/shared/errors/report-unavailable-error";
import { htmlToPdf } from "@/shared/integrations/pdf/gotenberg";
import { todayInSaoPaulo } from "@/shared/dates";

export type GeneratedReport = { fileName: string; pdf: Buffer };

/**
 * Gera um relatório em PDF do tenant. HTML montado no servidor (após o gate de
 * tenant) → Gotenberg. Tipo inexistente → NOT_FOUND; tipo ainda não
 * implementado ou serviço ausente → REPORT_UNAVAILABLE (503).
 */
export async function generateReport(
  orgId: string,
  orgName: string,
  type: string,
): Promise<GeneratedReport> {
  const report = findReportType(type);
  if (!report) throw new NotFoundError();
  if (!report.available) throw new ReportUnavailableError();

  const today = todayInSaoPaulo();

  if (type === "organization-summary") {
    const summary = await dashboardRepo.getDashboardSummary(orgId);
    const html = buildOrgSummaryHtml(orgName, summary, today);
    return { fileName: `resumo-organizacao-${today}.pdf`, pdf: await htmlToPdf(html) };
  }

  if (type === "esocial-events") {
    const events = await listEsocialEventsForReport(orgId);
    const html = buildEsocialEventsHtml(orgName, events, today);
    return { fileName: `eventos-esocial-${today}.pdf`, pdf: await htmlToPdf(html) };
  }

  if (type === "onboarding-manual") {
    const html = buildOnboardingManualHtml(orgName, today);
    return { fileName: `manual-onboarding-${today}.pdf`, pdf: await htmlToPdf(html) };
  }

  throw new ReportUnavailableError();
}
