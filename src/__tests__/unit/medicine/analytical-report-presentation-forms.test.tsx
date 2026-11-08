/**
 * Formulários de apresentação e discussão do relatório analítico (NOB-112): erros de lista e de
 * seção aparecem junto da seção ou da linha (não só "Dados inválidos."), linha parcialmente
 * preenchida não some sem aviso, permissão continua como mensagem de permissão e falha
 * inesperada vira mensagem segura. Dados fictícios.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import {
  DiscussionForm,
  PresentationForm,
  VoidReportEventForm,
} from "@/app/(protected)/companies/[id]/analytical-report/presentation-controls";
import {
  registerReportEventAction,
  voidReportEventAction,
} from "@/shared/server/actions/medicine/analytical-reports";

const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/analytical-reports", () => ({
  registerReportEventAction: jest.fn(),
  voidReportEventAction: jest.fn(),
}));

const register = registerReportEventAction as jest.Mock;
const voidEvent = voidReportEventAction as jest.Mock;

const COMPANY = "c1111111-1111-4111-8111-111111111111";
const REPORT = "r1111111-1111-4111-8111-111111111111";
const EVENT = "e1111111-1111-4111-8111-111111111111";

const invalid = (fields: Record<string, string>) => ({
  ok: false,
  error: { code: "VALIDATION", message: "Dados inválidos.", fields },
});

const participantsGroup = () =>
  screen.getByRole("group", { name: /Participantes \(função/ });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PresentationForm", () => {
  it("lista vazia: a mensagem do servidor aparece na seção de participantes", async () => {
    register.mockResolvedValue(
      invalid({ participants: "Informe ao menos uma função representada." }),
    );
    render(<PresentationForm companyId={COMPANY} reportId={REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar apresentação realizada" }));

    await waitFor(() => expect(register).toHaveBeenCalled());
    // A linha vazia padrão não é enviada.
    expect(register.mock.calls[0][2]).toMatchObject({ participants: [] });
    expect(
      await within(participantsGroup()).findByText(
        "Informe ao menos uma função representada.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Revise os campos destacados.");
    expect(screen.queryByText("Dados inválidos.")).not.toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("CIPA participou sem representante da CIPA: aviso na seção de participantes", async () => {
    register.mockResolvedValue(
      invalid({
        participants:
          "Se a CIPA participou, inclua o representante da CIPA entre os participantes.",
      }),
    );
    render(<PresentationForm companyId={COMPANY} reportId={REPORT} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Situação da CIPA/ }), {
      target: { value: "participated" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Função/ }), {
      target: { value: "employer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar apresentação realizada" }));

    expect(
      await within(participantsGroup()).findByText(
        /Se a CIPA participou, inclua o representante da CIPA/,
      ),
    ).toBeInTheDocument();
    expect(register.mock.calls[0][2]).toMatchObject({
      cipaSituation: "participated",
      participants: [{ role: "employer" }],
    });
  });

  it("linha com nome e sem função não some: o erro volta à linha certa da tela", async () => {
    register.mockResolvedValue(
      invalid({ "participants.1.role": "Selecione a função do participante." }),
    );
    render(<PresentationForm companyId={COMPANY} reportId={REPORT} />);
    // Tela: [vazia, CIPA, só nome] → enviados: [CIPA, só nome].
    fireEvent.click(screen.getByRole("button", { name: "Adicionar participante" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar participante" }));
    const roles = () => screen.getAllByRole("combobox", { name: /^Função/ });
    const names = () => screen.getAllByRole("textbox", { name: /^Nome \(opcional\)/ });
    fireEvent.change(roles()[1], { target: { value: "cipa" } });
    fireEvent.change(names()[2], { target: { value: "Pessoa Fictícia" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar apresentação realizada" }));

    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][2].participants).toEqual([
      { role: "cipa" },
      { role: "", name: "Pessoa Fictícia" },
    ]);
    expect(
      await screen.findByText("Selecione a função do participante."),
    ).toBeInTheDocument();
    expect(roles()[2]).toHaveAttribute("aria-invalid", "true");
    expect(roles()[1]).not.toHaveAttribute("aria-invalid");
  });

  it("FORBIDDEN mostra a mensagem de permissão, não a de validação", async () => {
    register.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Você não tem permissão para registrar a apresentação.",
      },
    });
    render(<PresentationForm companyId={COMPANY} reportId={REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar apresentação realizada" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para registrar a apresentação.",
    );
    expect(screen.queryByText(/Revise os campos/)).not.toBeInTheDocument();
  });

  it("falha inesperada vira mensagem segura, sem detalhe técnico", async () => {
    register.mockRejectedValue(new Error('relation "x" does not exist at /srv/app.js'));
    render(<PresentationForm companyId={COMPANY} reportId={REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar apresentação realizada" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir a operação. Tente novamente.",
    );
    expect(screen.queryByText(/relation|srv/)).not.toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("DiscussionForm", () => {
  it("medida sem descrição, mas com responsável, não é descartada: erro na própria linha", async () => {
    register.mockResolvedValue(
      invalid({
        "measures.0.description":
          "Descreva a medida ou o encaminhamento (mínimo de 5 caracteres).",
      }),
    );
    render(<DiscussionForm companyId={COMPANY} reportId={REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar medida" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Responsável \(se definido\)/ }), {
      target: { value: "Gestor Fictício" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar discussão realizada" }));

    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][2].measures).toEqual([
      { description: "", responsible: "Gestor Fictício", dueDate: undefined },
    ]);
    expect(
      await screen.findByText(
        "Descreva a medida ou o encaminhamento (mínimo de 5 caracteres).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /^Medida ou encaminhamento/ }),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("linha de medida toda em branco continua fora do envio", async () => {
    register.mockResolvedValue({ ok: true, data: {} });
    render(<DiscussionForm companyId={COMPANY} reportId={REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar medida" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar discussão realizada" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(register.mock.calls[0][2].measures).toEqual([]);
  });

  it("vários erros ao mesmo tempo: cada um no seu lugar; sem lugar vira item legível", async () => {
    register.mockResolvedValue(
      invalid({
        occurredOn: "Data inválida.",
        participants: "Informe ao menos uma função representada.",
        summary: "Registre a síntese da discussão (mínimo de 10 caracteres).",
        "measures.0.description":
          "Descreva a medida ou o encaminhamento (mínimo de 5 caracteres).",
        "participants.5.name": "Máximo de 120 caracteres.",
        kind: "Invalid input",
      }),
    );
    render(<DiscussionForm companyId={COMPANY} reportId={REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar medida" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Medida ou encaminhamento/ }), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar discussão realizada" }));

    expect(await screen.findByText("Data inválida.")).toBeInTheDocument();
    expect(
      within(participantsGroup()).getByText("Informe ao menos uma função representada."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Registre a síntese da discussão (mínimo de 10 caracteres)."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Descreva a medida ou o encaminhamento (mínimo de 5 caracteres)."),
    ).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Revise os campos destacados e os pontos abaixo.");
    expect(
      within(alert).getByText("Participante 6 — nome: Máximo de 120 caracteres."),
    ).toBeInTheDocument();
    expect(within(alert).getByText("Valor inválido.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/participants\.\d|measures\.\d/);
    expect(document.body).not.toHaveTextContent(/Invalid input|Too small/);
  });

  it("mensagem padrão do Zod em inglês nunca aparece", async () => {
    register.mockResolvedValue(
      invalid({ summary: "Too small: expected string to have >=10 characters" }),
    );
    render(<DiscussionForm companyId={COMPANY} reportId={REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar discussão realizada" }));

    expect(await screen.findByText("Valor inválido.")).toBeInTheDocument();
    expect(screen.queryByText(/Too small/)).not.toBeInTheDocument();
  });
});

describe("VoidReportEventForm", () => {
  it("motivo curto: a mensagem do motivo aparece no campo (não 'Dados inválidos.')", async () => {
    voidEvent.mockResolvedValue(
      invalid({ reason: "Explique a correção em pelo menos 10 caracteres." }),
    );
    render(<VoidReportEventForm companyId={COMPANY} eventId={EVENT} />);
    fireEvent.click(screen.getByRole("button", { name: "Corrigir registro" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar correção" }));

    expect(
      await screen.findByText("Explique a correção em pelo menos 10 caracteres."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dados inválidos.")).not.toBeInTheDocument();
  });

  it("FORBIDDEN fica no resumo do formulário, sem marcar o motivo como inválido", async () => {
    voidEvent.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Você não tem permissão para corrigir." },
    });
    render(<VoidReportEventForm companyId={COMPANY} eventId={EVENT} />);
    fireEvent.click(screen.getByRole("button", { name: "Corrigir registro" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar correção" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para corrigir.",
    );
    expect(screen.getByRole("textbox", { name: /Motivo da correção/ })).not.toHaveAttribute(
      "aria-invalid",
    );
  });
});
