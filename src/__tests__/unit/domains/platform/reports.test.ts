import {
  REPORT_TYPES,
  buildOrgSummaryHtml,
  findReportType,
} from "@/shared/domains/platform/reports";
import type { DashboardSummary } from "@/shared/domains/platform/dashboard";

const summary: DashboardSummary = {
  kpis: { companies: 3, employees: 12, workUnits: 2, ges: 4, risks: 7, pgrs: 1 },
  risksByAgentType: [],
  actionPlansByLevel: [],
  pending: {
    pgrsExpired: 1,
    controlsOverdue: 0,
    episLowStock: 2,
    episPendingReturn: 0,
    trainingsExpired: 0,
    trainingsDueSoon: 5,
  },
};

describe("registro de relatórios", () => {
  it("expõe o resumo da organização como disponível", () => {
    expect(findReportType("organization-summary")?.available).toBe(true);
  });

  it("tipos planejados aparecem como indisponíveis; tipo desconhecido → undefined", () => {
    expect(findReportType("esocial-events")?.available).toBe(false);
    expect(findReportType("nope")).toBeUndefined();
    expect(REPORT_TYPES.length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildOrgSummaryHtml", () => {
  it("inclui o nome da org e os KPIs/pendências", () => {
    const html = buildOrgSummaryHtml("Escritório A", summary, "2026-07-14");
    expect(html).toContain("Escritório A");
    expect(html).toContain("Empresas");
    expect(html).toContain(">3<"); // KPI empresas
    expect(html).toContain("2026-07-14");
  });

  it("escapa HTML do nome da organização (anti-injeção no template)", () => {
    const html = buildOrgSummaryHtml("<script>x</script>", summary, "2026-07-14");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
