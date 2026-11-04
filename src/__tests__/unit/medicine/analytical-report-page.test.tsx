/**
 * Tela do relatório analítico (NOB-154): sem relatório anterior, pede o período do primeiro; com
 * relatório, mostra a prévia com aviso, alíneas c/d insuficientes e campo de discussão. Fictício.
 */
import { render, screen } from "@testing-library/react";

import AnalyticalReportPage from "@/app/(protected)/companies/[id]/analytical-report/page";
import {
  composeAnalyticalReport,
  countCats,
  countClinicalExams,
  countProcedures,
} from "@/shared/domains/medicine/analytical-report";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import {
  getAnalyticalReportAction,
  getAnalyticalReportContextAction,
  listAnalyticalReportsAction,
  listReportPresentationAction,
} from "@/shared/server/actions/medicine/analytical-reports";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn().mockResolvedValue({ role: "collaborator" }),
}));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  getCompanyAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/analytical-reports", () => ({
  listAnalyticalReportsAction: jest.fn(),
  getAnalyticalReportAction: jest.fn(),
  getAnalyticalReportContextAction: jest.fn(),
  generateAnalyticalReportAction: jest.fn(),
  listReportPresentationAction: jest.fn(),
  registerReportEventAction: jest.fn(),
  voidReportEventAction: jest.fn(),
}));

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const content = composeAnalyticalReport({
  period: { periodStart: "2025-11-01", periodEnd: "2026-10-31" },
  company: { razaoSocial: "Empresa Fictícia", cnpj: "11222333000181", riskGrade: 3 },
  employees: 40,
  author: { name: "Dra. Coordenadora", registration: "CRM 1/MA" },
  simplified: false,
  clinical: {
    ...countClinicalExams([
      { employeeId: "e1", examType: "periodic", performedAt: "2026-03-01" },
    ]),
    unverifiedOrigin: 0,
  },
  complementary: countProcedures([{ procedureCode: "0281", otherDescription: null }]),
  cats: countCats([], 0),
  previous: null,
  variationDiscussion: null,
  insufficiencyNote: null,
});
const DOC = {
  id: "r1",
  version: 1,
  periodStart: "2025-11-01",
  periodEnd: "2026-10-31",
  generatedAt: "2026-11-02T10:00:00.000Z",
  contentSha256: "d".repeat(64),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { razaoSocial: "Empresa Fictícia" },
  });
  (listReportPresentationAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: {
      current: null,
      summary: {
        state: "no_report",
        cipaSituation: null,
        cipaRequirementMet: false,
        previousVersionPresented: false,
      },
      events: [],
    },
  });
});

async function renderPage() {
  render(await AnalyticalReportPage({ params: Promise.resolve({ id: COMPANY }) }));
}

describe("AnalyticalReportPage", () => {
  it("sem relatório anterior, pede o período do primeiro e não mostra discussão", async () => {
    (listAnalyticalReportsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    (getAnalyticalReportContextAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { previous: null, suggestedPeriod: null, eligibility: null },
    });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nenhum relatório analítico anterior registrado",
    );
    expect(
      screen.queryByLabelText(/Discussão sobre as variações/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Elaborar prévia do relatório" }),
    ).toBeInTheDocument();
  });

  it("com relatório, mostra a prévia com aviso, c/d insuficientes e pede a discussão", async () => {
    (listAnalyticalReportsAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: [DOC],
    });
    (getAnalyticalReportAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ...DOC, content },
    });
    (getAnalyticalReportContextAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        previous: {
          id: "r1",
          version: 1,
          periodStart: "2025-11-01",
          periodEnd: "2026-10-31",
        },
        suggestedPeriod: { periodStart: "2026-11-01", periodEnd: "2026-11-02" },
        eligibility: { eligible: false, basis: "x" },
      },
    });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "O próximo começa em 2026-11-01",
    );
    expect(screen.getByRole("note")).toHaveTextContent(/PRÉVIA/);
    expect(
      screen.getByRole("heading", {
        name: "c) Resultados anormais — Informação insuficiente",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Discussão sobre as variações/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Relatório simplificado/)).not.toBeInTheDocument();
    expect(
      screen.getByText(`SHA-256 ${"d".repeat(64)}`, { exact: false }),
    ).toBeInTheDocument();
  });
  it("apresentação (NOB-168): CIPA não verificada avisa; medidas ficam como propostas; versão não finalizada pede finalização", async () => {
    (listAnalyticalReportsAction as jest.Mock).mockResolvedValue({ ok: true, data: [] });
    (getAnalyticalReportContextAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { message: "x" },
    });
    const event = {
      reportId: "r1",
      reportSha256: "d".repeat(64),
      occurredOn: "2026-11-03",
      modality: null,
      participants: null,
      cipaSituation: null,
      cipaReference: null,
      summary: null,
      measures: null,
      evidenceReference: null,
      note: null,
      voidsId: null,
      voidReason: null,
      recordedBy: "staff",
      recordedAt: "2026-11-03T12:00:00.000Z",
    };
    (listReportPresentationAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        current: {
          id: "r1",
          version: 1,
          periodStart: "2025-11-01",
          periodEnd: "2026-10-31",
          contentSha256: "d".repeat(64),
        },
        summary: {
          state: "presented_and_discussed",
          cipaSituation: "unknown",
          cipaRequirementMet: false,
          previousVersionPresented: false,
        },
        events: [
          {
            ...event,
            id: "e1",
            kind: "finalized",
            occurredOn: null,
            recordedBy: "doctor",
          },
          {
            ...event,
            id: "e2",
            kind: "presented",
            modality: "in_person",
            participants: [{ role: "sst_responsible", name: "Fulana" }],
            cipaSituation: "unknown",
            evidenceReference: "Ata 12",
          },
          {
            ...event,
            id: "e3",
            kind: "discussed",
            participants: [{ role: "pcmso_coordinator" }],
            summary: "Síntese agregada fictícia.",
            measures: [{ description: "Revisar cronograma", dueDate: "2027-02-28" }],
          },
        ],
      },
    });
    await renderPage();
    expect(screen.getByText(/Apresentação e discussão registradas/)).toBeInTheDocument();
    expect(
      screen.getByText(/não é possível declarar a participação da CIPA atendida/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Revisar cronograma · prazo: 2027-02-28 · proposta/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Responsável por SST da organização \(Fulana\)/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Finalizar versão/ }),
    ).not.toBeInTheDocument();
  });
});
