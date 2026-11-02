/**
 * Tela dos critérios de interpretação (NOB-153): sem plano aprovado, avisa; com plano, mostra o
 * critério vigente com autor e versão, os pendentes e o formulário sem texto do sistema. Fictício.
 */
import { render, screen } from "@testing-library/react";

import InterpretationCriteriaPage from "@/app/(protected)/companies/[id]/interpretation-criteria/page";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { listInterpretationCriteriaAction } from "@/shared/server/actions/medicine/interpretation-criteria";

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
jest.mock("@/shared/server/actions/medicine/interpretation-criteria", () => ({
  listInterpretationCriteriaAction: jest.fn(),
  defineInterpretationCriteriaAction: jest.fn(),
}));

const COMPANY = "c1111111-1111-4111-8111-111111111111";

beforeEach(() => {
  jest.clearAllMocks();
  (getCompanyAction as jest.Mock).mockResolvedValue({
    ok: true,
    data: { razaoSocial: "Empresa Fictícia" },
  });
});

async function renderPage() {
  render(await InterpretationCriteriaPage({ params: Promise.resolve({ id: COMPANY }) }));
}

describe("InterpretationCriteriaPage", () => {
  it("sem plano aprovado, avisa e não lista exames", async () => {
    (listInterpretationCriteriaAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: { approvedPlanVersion: null, rows: [], missing: [] },
    });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ainda não há plano de exames aprovado",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("mostra o vigente com autor e versão, o pendente e formulários sem texto do sistema", async () => {
    (listInterpretationCriteriaAction as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        approvedPlanVersion: 2,
        missing: [{ procedureCode: "9999", description: "Exame fictício" }],
        rows: [
          {
            procedureCode: "0281",
            otherDescription: null,
            description: "Audiometria tonal ocupacional",
            inApprovedPlan: true,
            current: {
              id: "k1",
              procedureCode: "0281",
              otherDescription: null,
              version: 3,
              criteria: "Critério fictício.",
              conduct: "Conduta fictícia.",
              authorName: "Dra. Fictícia",
              authoredAt: "2026-11-01T10:00:00.000Z",
            },
          },
          {
            procedureCode: "9999",
            otherDescription: "Exame fictício",
            description: "Exame fictício",
            inApprovedPlan: true,
            current: null,
          },
        ],
      },
    });
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Plano aprovado versão 2: 1 exame(s) sem critério do coordenador.",
    );
    expect(screen.getByText(/versão 3 · Dra. Fictícia · 2026-11-01/)).toBeInTheDocument();
    expect(
      screen.getByText(/pendente de definição pelo médico coordenador/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar nova versão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar critérios" }),
    ).toBeInTheDocument();
    const empty = screen.getAllByLabelText(/Critérios de interpretação dos achados/)[1];
    expect(empty).toHaveValue("");
  });
});
