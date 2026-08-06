import {
  REPORT_TYPES,
  buildEsocialEventsHtml,
  buildOnboardingManualHtml,
  buildOrgSummaryHtml,
  findReportType,
} from "@/shared/domains/platform/reports";
import type { DashboardSummary } from "@/shared/domains/platform/dashboard";
import type { EventListItem } from "@/shared/domains/esocial/events";

const summary: DashboardSummary = {
  kpis: { companies: 3, employees: 12, workUnits: 2, ges: 4, risks: 7, pgrs: 1 },
  employeesBreakdown: { active: 10, inactive: 2 },
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

  it("eSocial e manual de onboarding estão disponíveis (#83); tipo desconhecido → undefined", () => {
    expect(findReportType("esocial-events")?.available).toBe(true);
    expect(findReportType("onboarding-manual")?.available).toBe(true);
    expect(findReportType("nope")).toBeUndefined();
    expect(REPORT_TYPES.length).toBeGreaterThanOrEqual(3);
  });
});

const esocialEvents: EventListItem[] = [
  {
    id: "e1",
    eventType: "S-2210",
    eventTypeLabel: "S-2210 (CAT)",
    status: "sent",
    statusLabel: "Enviado",
    referenceId: "ref-1",
    batchId: "batch-1",
    createdAt: "2026-07-10T12:00:00.000Z",
  },
  {
    id: "e2",
    eventType: "S-2240",
    eventTypeLabel: "S-2240 (Insalubridade)",
    status: "pending",
    statusLabel: "Pendente",
    referenceId: null,
    batchId: null,
    createdAt: "2026-07-11T12:00:00.000Z",
  },
];

describe("buildEsocialEventsHtml", () => {
  it("inclui org, resumo por situação e a tabela de eventos", () => {
    const html = buildEsocialEventsHtml("Escritório A", esocialEvents, "2026-07-14");
    expect(html).toContain("Escritório A");
    expect(html).toContain("2 evento(s)");
    expect(html).toContain("S-2210 (CAT)");
    expect(html).toContain("Enviado");
    expect(html).toContain("2026-07-10");
  });

  it("renderiza empty-state quando não há eventos", () => {
    const html = buildEsocialEventsHtml("Escritório A", [], "2026-07-14");
    expect(html).toContain("Nenhum evento eSocial registrado.");
    expect(html).toContain("0 evento(s)");
  });

  it("escapa HTML do nome da organização", () => {
    const html = buildEsocialEventsHtml("<b>x</b>", [], "2026-07-14");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("buildOnboardingManualHtml", () => {
  it("inclui os passos de primeiros passos", () => {
    const html = buildOnboardingManualHtml("Escritório A", "2026-07-14");
    expect(html).toContain("Manual de onboarding");
    expect(html).toContain("Cadastrar a primeira empresa");
    expect(html).toContain("Criar o documento PGR");
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
