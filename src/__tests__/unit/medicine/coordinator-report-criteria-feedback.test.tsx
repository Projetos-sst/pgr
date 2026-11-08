/**
 * NOB-112 (etapa E): elaboração do relatório analítico, critérios de interpretação e designação/
 * encerramento do coordenador do PCMSO. Erro de chave sem campo na tela (exame do critério,
 * discussão de variações sem relatório anterior, empresa) aparece legível (antes sumia), inglês do
 * Zod nunca aparece, FORBIDDEN cru vira permissão e promessa rejeitada vira mensagem genérica,
 * mantendo o que foi digitado. Dados fictícios.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { ReportForm } from "@/app/(protected)/companies/[id]/analytical-report/report-form";
import { CriteriaForm } from "@/app/(protected)/companies/[id]/interpretation-criteria/criteria-form";
import {
  CloseCoordinatorForm,
  DesignateCoordinatorForm,
} from "@/app/(protected)/companies/[id]/pcmso-coordinator/coordinator-forms";
import { generateAnalyticalReportAction } from "@/shared/server/actions/medicine/analytical-reports";
import { defineInterpretationCriteriaAction } from "@/shared/server/actions/medicine/interpretation-criteria";
import {
  closePcmsoCoordinatorAction,
  designatePcmsoCoordinatorAction,
} from "@/shared/server/actions/medicine/pcmso-coordinators";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/analytical-reports", () => ({
  generateAnalyticalReportAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/interpretation-criteria", () => ({
  defineInterpretationCriteriaAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/medicine/pcmso-coordinators", () => ({
  designatePcmsoCoordinatorAction: jest.fn(),
  closePcmsoCoordinatorAction: jest.fn(),
}));

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const GENERIC = "Não foi possível concluir a operação. Tente novamente.";
const invalid = (fields: Record<string, string>) => ({
  ok: false,
  error: { code: "VALIDATION", message: "Dados inválidos.", fields },
});

beforeEach(() => jest.clearAllMocks());

describe("relatório analítico (elaboração)", () => {
  it("discussão de variações sem campo na tela aparece legível no resumo", async () => {
    (generateAnalyticalReportAction as jest.Mock).mockResolvedValue(
      invalid({
        variationDiscussion: "Discuta as variações em relação ao relatório anterior.",
        periodEnd: "O fim não pode ser anterior ao início.",
      }),
    );
    render(
      <ReportForm
        companyId={COMPANY}
        suggested={{ periodStart: "2025-11-01", periodEnd: "2026-10-31" }}
        hasPrevious={false}
        canSimplify={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Elaborar prévia do relatório" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Discussão sobre as variações: Discuta as variações em relação ao relatório anterior.",
    );
    expect(screen.getByLabelText(/^Fim do período/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("promessa rejeitada: mensagem genérica e texto do médico mantido", async () => {
    (generateAnalyticalReportAction as jest.Mock).mockRejectedValue(new Error("x"));
    render(
      <ReportForm companyId={COMPANY} suggested={null} hasPrevious canSimplify={false} />,
    );
    const note = screen.getByRole("textbox", { name: /^Informações insuficientes/ });
    fireEvent.change(note, {
      target: { value: "Prontuários de outubro não recebidos." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Elaborar prévia do relatório" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(note).toHaveValue("Prontuários de outubro não recebidos.");
  });
});

describe("critérios de interpretação", () => {
  it("erro do exame (sem campo na tela) e inglês do Zod: resumo legível, nada cru", async () => {
    (defineInterpretationCriteriaAction as jest.Mock).mockResolvedValue(
      invalid({
        otherDescription: "Descreva o procedimento do código 9999.",
        criteria: "Too small: expected string to have >=10 characters",
      }),
    );
    render(
      <CriteriaForm
        companyId={COMPANY}
        procedureCode="9999"
        otherDescription={null}
        current={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar critérios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Descrição do procedimento: Descreva o procedimento do código 9999.",
    );
    expect(
      screen.getByRole("textbox", { name: /^Critérios de interpretação/ }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Valor inválido.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Too small|otherDescription/);
  });

  it("FORBIDDEN cru vira permissão e o texto digitado fica", async () => {
    (defineInterpretationCriteriaAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    render(
      <CriteriaForm
        companyId={COMPANY}
        procedureCode="0281"
        otherDescription={null}
        current={{ criteria: "Critério fictício vigente.", conduct: "Conduta fictícia." }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar nova versão" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );
    expect(
      screen.getByRole("textbox", { name: /^Planejamento das condutas/ }),
    ).toHaveValue("Conduta fictícia.");
  });
});

describe("coordenador do PCMSO", () => {
  it("designação: chave sem campo (empresa) legível; erro do médico no próprio campo", async () => {
    (designatePcmsoCoordinatorAction as jest.Mock).mockResolvedValue(
      invalid({ companyId: "Empresa inválida.", medicoId: "Selecione o médico." }),
    );
    render(<DesignateCoordinatorForm companyId={COMPANY} options={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar designação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Empresa: Empresa inválida.",
    );
    const select = screen.getByRole("combobox", { name: /^Médico/ });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Selecione o médico.");
  });

  it("encerramento: promessa rejeitada vira mensagem genérica e o motivo fica", async () => {
    (closePcmsoCoordinatorAction as jest.Mock).mockRejectedValue(new Error("x"));
    render(
      <CloseCoordinatorForm
        companyId={COMPANY}
        assignmentId="d1111111-1111-4111-8111-111111111111"
        startsOn="2026-01-01"
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Motivo/), {
      target: { value: "Encerramento do contrato." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar designação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.getByLabelText(/^Motivo/)).toHaveValue("Encerramento do contrato.");
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
