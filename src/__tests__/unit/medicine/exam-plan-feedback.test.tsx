/**
 * NOB-112 (etapa E): decisão do item, aprovação e rascunho do plano de exames. Erro da decisão
 * (que não tinha lugar na tela) e erro de regra na raiz aparecem; FORBIDDEN vira mensagem de
 * permissão em português; falha de rede mantém a mensagem própria do plano (#167) e os valores.
 * Dados fictícios.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import {
  ApproveForm,
  CreateDraftButton,
  ItemDecisionForm,
} from "@/app/(protected)/companies/[id]/exam-plan/plan-controls";
import {
  approveExamPlanAction,
  createExamPlanDraftAction,
  decideExamPlanItemAction,
} from "@/shared/server/actions/medicine/exam-plans";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }),
}));
jest.mock("@/shared/server/actions/medicine/exam-plans", () => ({
  createExamPlanDraftAction: jest.fn(),
  decideExamPlanItemAction: jest.fn(),
  addExamPlanItemAction: jest.fn(),
  approveExamPlanAction: jest.fn(),
}));

const PLAN = "p1111111-1111-4111-8111-111111111111";
const ITEM = "i1111111-1111-4111-8111-111111111111";
const COMPANY = "c1111111-1111-4111-8111-111111111111";
const NETWORK = /Não foi possível concluir agora/;

beforeEach(() => jest.clearAllMocks());

function renderDecision() {
  render(
    <ItemDecisionForm
      planId={PLAN}
      itemId={ITEM}
      decision="kept"
      periodicity="Anual"
      justification={null}
      origin="suggested"
    />,
  );
}

describe("decisão do item", () => {
  it("erro da decisão fica no campo e erro de regra na raiz vai ao resumo", async () => {
    (decideExamPlanItemAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: {
          decision: "Escolha manter ou retirar o exame.",
          _: 'Unrecognized key: "approvedBy"',
          itemId: "Item do plano inválido.",
        },
      },
    });
    renderDecision();
    fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));

    expect(
      await screen.findByText("Escolha manter ou retirar o exame."),
    ).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: /^Decisão/ });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Escolha manter ou retirar o exame.");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Item do plano inválido.");
    expect(alert).toHaveTextContent("Valor inválido.");
    expect(document.body).not.toHaveTextContent(/Unrecognized key|itemId/);
    expect(screen.getByRole("textbox", { name: /^Periodicidade/ })).toHaveValue("Anual");
  });

  it("promessa rejeitada: mensagem de rede do plano e valores mantidos", async () => {
    (decideExamPlanItemAction as jest.Mock).mockRejectedValue(new TypeError("fetch"));
    renderDecision();
    fireEvent.change(screen.getByRole("textbox", { name: /^Periodicidade/ }), {
      target: { value: "Semestral" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(NETWORK);
    expect(screen.getByRole("textbox", { name: /^Periodicidade/ })).toHaveValue(
      "Semestral",
    );
  });
});

describe("aprovação e rascunho", () => {
  it("aprovação: FORBIDDEN cru vira mensagem de permissão, não de validação", async () => {
    (approveExamPlanAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "FORBIDDEN" },
    });
    render(<ApproveForm planId={PLAN} />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar plano" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para esta operação.",
    );
    expect(screen.queryByText(/Revise os campos/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Observação/ })).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("aprovação: erro de campo de outra chave aparece legível no resumo", async () => {
    (approveExamPlanAction as jest.Mock).mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Dados inválidos.",
        fields: { periodicity: "Informe a periodicidade." },
      },
    });
    render(<ApproveForm planId={PLAN} />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar plano" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Periodicidade: Informe a periodicidade.",
    );
  });

  it("rascunho: NOT_FOUND tem mensagem própria e falha de rede não trava o botão", async () => {
    (createExamPlanDraftAction as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: { code: "NOT_FOUND", message: "NOT_FOUND" },
    });
    render(<CreateDraftButton companyId={COMPANY} />);
    const name = "Preparar rascunho a partir da proposta";
    fireEvent.click(screen.getByRole("button", { name }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Registro não encontrado. Ele pode ter sido removido.",
    );

    (createExamPlanDraftAction as jest.Mock).mockRejectedValueOnce(new Error("x"));
    fireEvent.click(await screen.findByRole("button", { name }));
    expect(await screen.findByText(NETWORK)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name })).toBeEnabled();
  });
});
