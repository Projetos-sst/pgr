/**
 * Tela da conferência do PCMSO (NOB-148): agrupa pendências, etapas inexistentes e avisos;
 * nunca afirma que o PCMSO está pronto com etapa inexistente; sem botão de gerar. Dados fictícios.
 */
import { render, screen } from "@testing-library/react";

import PcmsoReadinessPage from "@/app/(protected)/companies/[id]/pcmso-readiness/page";
import { buildExamProposal } from "@/shared/domains/medicine/exam-proposal";
import { checkPcmsoReadiness } from "@/shared/domains/medicine/pcmso-readiness";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getPcmsoReadinessAction } from "@/shared/server/actions/medicine/pcmso-readiness";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
jest.mock("@/shared/auth/page-guards", () => ({
  requireOfficeStaffPage: jest.fn().mockResolvedValue({ role: "owner" }),
}));
jest.mock("@/shared/server/actions/pgr/companies", () => ({
  getCompanyAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/pcmso-readiness", () => ({
  getPcmsoReadinessAction: jest.fn(),
}));

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const getCompany = getCompanyAction as jest.Mock;
const getReadiness = getPcmsoReadinessAction as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  getCompany.mockResolvedValue({ ok: true, data: { razaoSocial: "Empresa Fictícia" } });
});

async function renderPage() {
  render(await PcmsoReadinessPage({ params: Promise.resolve({ id: COMPANY }) }));
}

describe("PcmsoReadinessPage", () => {
  it("mostra pendências com link, etapas inexistentes e o resumo, sem botão", async () => {
    getReadiness.mockResolvedValue({
      ok: true,
      data: checkPcmsoReadiness({
        companyId: COMPANY,
        company: {
          razaoSocial: "Empresa Fictícia",
          cnpj: "11222333000181",
          cnae: null,
          mainActivity: "Construção",
          riskGrade: 3,
        },
        activeEmployees: 3,
        coordinator: null,
        proposal: buildExamProposal([]),
        usableRisks: [],
        activePhysicians: 1,
        examPlan: { approved: null, draftVersion: null },
      }),
    });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "O PCMSO ainda não pode ser gerado: 4 pendência(s), 4 etapa(s)",
    );
    expect(
      screen.getByRole("heading", { name: "Pendências que impedem a geração (4)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Etapas que o sistema ainda não tem (4)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Designe o médico responsável pelo PCMSO da empresa."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Corrigir" })[0]).toHaveAttribute(
      "href",
      `/companies/${COMPANY}/edit`,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("erro do servidor (ex.: sem Medicina) aparece como alerta", async () => {
    getReadiness.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Medicina não habilitada para esta empresa." },
    });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Medicina não habilitada");
  });

  it("empresa de outro tenant cai no notFound sem consultar a conferência", async () => {
    getCompany.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "x" },
    });
    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getReadiness).not.toHaveBeenCalled();
  });
});
