/**
 * NOB-112 (etapa E): registro da fonte de riscos (PGR externo). Antes, a validação local mostrava
 * só o primeiro erro, muitas vezes em inglês ("Invalid option…", "Too small…"), e o erro do
 * servidor virava "Dados inválidos.". Agora cada erro vai ao campo da linha do risco certa, o que
 * não tem lugar na tela vira item legível, FORBIDDEN cru vira permissão e falha inesperada mantém
 * o que foi digitado. Dados fictícios.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { SourceForm } from "@/app/(protected)/companies/[id]/medical-risks/source-form";
import { registerMedicalRiskSourceAction } from "@/shared/server/actions/medicine/risk-sources";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/risk-sources", () => ({
  registerMedicalRiskSourceAction: jest.fn(),
}));

const register = registerMedicalRiskSourceAction as jest.Mock;
const COMPANY = "c1111111-1111-4111-8111-111111111111";
const ENGLISH = /Invalid option|Invalid input|Too small|Too big|expected/;

beforeEach(() => jest.clearAllMocks());

function renderForm() {
  render(<SourceForm companyId={COMPANY} pgrs={[]} sources={[]} />);
}
const textbox = (name: RegExp) => screen.getByRole("textbox", { name });
function fillSource() {
  fireEvent.change(textbox(/^Título da fonte/), { target: { value: "PGR fictício" } });
  fireEvent.change(textbox(/^Referência do documento/), {
    target: { value: "GED: PGR fictício, revisão 2" },
  });
  fireEvent.change(textbox(/^Versão do documento/), { target: { value: "2" } });
}
function fillRisk() {
  fireEvent.change(screen.getByRole("combobox", { name: /^Categoria/ }), {
    target: { value: "chemical" },
  });
  fireEvent.change(textbox(/^Descrição do risco/), {
    target: { value: "Poeira fictícia" },
  });
  fireEvent.change(textbox(/^Grupo \/ contexto/), { target: { value: "Produção" } });
}
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Registrar para revisão" }));

describe("fonte de riscos", () => {
  it("validação local: todos os erros na linha do risco, em português, sem enviar", async () => {
    renderForm();
    fillSource();
    fireEvent.change(textbox(/^Descrição do risco/), { target: { value: "   " } });
    submit();

    const category = await screen.findByRole("combobox", { name: /^Categoria/ });
    expect(category).toHaveAttribute("aria-invalid", "true");
    expect(category).toHaveAccessibleDescription("Selecione a categoria do risco.");
    expect(textbox(/^Descrição do risco/)).toHaveAccessibleDescription(
      "Descreva o risco.",
    );
    expect(textbox(/^Grupo \/ contexto/)).toHaveAccessibleDescription(
      "Informe o grupo ou contexto de exposição.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Revise os campos destacados.");
    expect(document.body).not.toHaveTextContent(ENGLISH);
    expect(register).not.toHaveBeenCalled();
    expect(textbox(/^Título da fonte/)).toHaveValue("PGR fictício");
  });

  it("erro do servidor: campo da linha do risco no lugar e chave sem campo legível", async () => {
    register.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          "risks.0.noxiousAgentCode":
            "Código do agente nocivo no formato da Tabela 24 (ex.: 02.01.001).",
          companyId: "Empresa inválida.",
        },
      },
    });
    renderForm();
    fillSource();
    fillRisk();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Empresa inválida.");
    expect(textbox(/^Código do agente nocivo/)).toHaveAttribute("aria-invalid", "true");
    expect(textbox(/^Código do agente nocivo/)).toHaveAccessibleDescription(
      "Código do agente nocivo no formato da Tabela 24 (ex.: 02.01.001).",
    );
    expect(screen.queryByText(/^Dados inválidos\.$/)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/companyId|risks\.0/);
  });

  it("FORBIDDEN cru vira permissão, sem destacar campos", async () => {
    register.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    renderForm();
    fillSource();
    fillRisk();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );
    expect(textbox(/^Título da fonte/)).not.toHaveAttribute("aria-invalid");
  });

  it("promessa rejeitada: mensagem segura e o que foi digitado fica", async () => {
    register.mockRejectedValue(
      new Error("value too long for type character varying(200)"),
    );
    renderForm();
    fillSource();
    fillRisk();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível registrar a fonte. Tente novamente.",
    );
    expect(screen.queryByText(/character varying/)).not.toBeInTheDocument();
    expect(textbox(/^Descrição do risco/)).toHaveValue("Poeira fictícia");
    expect(textbox(/^Título da fonte/)).toHaveValue("PGR fictício");
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
