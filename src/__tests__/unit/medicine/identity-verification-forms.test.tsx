/**
 * Aprovação da verificação de identidade profissional (NOB-112): item do checklist não marcado
 * mostra a mensagem do próprio item (não só "Dados inválidos."), vários itens ao mesmo tempo,
 * erro sem lugar na tela vira item legível e permissão continua como mensagem de permissão.
 * Dados fictícios.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import {
  ApproveForm,
  DecisionForm,
} from "@/app/(protected)/admin-global/identity-verifications/verification-forms";
import {
  approveIdentityVerificationAction,
  rejectIdentityRequestAction,
} from "@/shared/server/actions/medicine/professional-identity";

const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/professional-identity", () => ({
  approveIdentityVerificationAction: jest.fn(),
  rejectIdentityRequestAction: jest.fn(),
  revokeIdentityVerificationAction: jest.fn(),
}));

const approve = approveIdentityVerificationAction as jest.Mock;
const reject = rejectIdentityRequestAction as jest.Mock;

const REQUEST = "a1111111-1111-4111-8111-111111111111";

beforeEach(() => {
  jest.clearAllMocks();
});

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Registrar verificação" }));

describe("ApproveForm", () => {
  it("itens do checklist não marcados: mensagem junto de cada item", async () => {
    approve.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          "checklist.registryStatus":
            "Confirme: situação do CRM/UF ativa na fonte oficial.",
          "checklist.accountControl":
            "Confirme: controle da conta autenticada comprovado.",
        },
      },
    });
    render(<ApproveForm requestId={REQUEST} crm="123" uf="MA" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Documento oficial/ }));
    submit();

    await waitFor(() => expect(approve).toHaveBeenCalled());
    expect(approve.mock.calls[0][0].checklist).toEqual({
      identityDocument: true,
      professionalDocument: false,
      registryStatus: false,
      personMatches: false,
      accountControl: false,
    });
    expect(
      await screen.findByText("Confirme: situação do CRM/UF ativa na fonte oficial."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Confirme: controle da conta autenticada comprovado."),
    ).toBeInTheDocument();
    const registry = screen.getByRole("checkbox", { name: /Situação do CRM\/UF/ });
    expect(registry).toHaveAttribute("aria-invalid", "true");
    expect(registry).toHaveAccessibleDescription(
      "Confirme: situação do CRM/UF ativa na fonte oficial.",
    );
    expect(
      screen.getByRole("checkbox", { name: /Documento oficial/ }),
    ).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("alert")).toHaveTextContent("Revise os campos destacados.");
    expect(screen.queryByText("Dados inválidos.")).not.toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("erro sem lugar na tela vira item legível; texto padrão do Zod não aparece", async () => {
    approve.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          requestId: "Pedido inválido.",
          crm: "Too big: expected string to have <=30 characters",
        },
      },
    });
    render(<ApproveForm requestId={REQUEST} crm="123" uf="MA" />);
    submit();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Pedido: Pedido inválido.")).toBeInTheDocument();
    expect(screen.getByText("Valor inválido.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/requestId|Too big/);
  });

  it("FORBIDDEN mostra a mensagem de permissão, sem destacar campos", async () => {
    approve.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "Acesso restrito ao operador designado." },
    });
    render(<ApproveForm requestId={REQUEST} crm="123" uf="MA" />);
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Acesso restrito ao operador designado.",
    );
    expect(screen.queryByText(/Revise os campos/)).not.toBeInTheDocument();
    for (const box of screen.getAllByRole("checkbox"))
      expect(box).not.toHaveAttribute("aria-invalid");
  });

  it("falha inesperada vira mensagem segura", async () => {
    approve.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));
    render(<ApproveForm requestId={REQUEST} crm="123" uf="MA" />);
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir a operação. Tente novamente.",
    );
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });
});

describe("DecisionForm", () => {
  it("motivo curto aparece no campo", async () => {
    reject.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { reason: "Descreva o motivo (mínimo de 10 caracteres)." },
      },
    });
    render(<DecisionForm id={REQUEST} kind="reject" />);
    fireEvent.click(screen.getByRole("button", { name: "Recusar pedido" }));

    expect(
      await screen.findByText("Descreva o motivo (mínimo de 10 caracteres)."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dados inválidos.")).not.toBeInTheDocument();
  });
});
