jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/safety/risk-audits", () => ({
  suggestActionPlanAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/safety/action-plans", () => ({
  createActionPlanAction: jest.fn(),
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";
import { createActionPlanAction } from "@/shared/server/actions/safety/action-plans";
import { suggestActionPlanAction } from "@/shared/server/actions/safety/risk-audits";

import { AuditPlanCreator } from "../audit-plan-creator";

const ORIGIN_ID = "11111111-1111-4111-8111-1111111111f1";

const mockedSuggest = jest.mocked(suggestActionPlanAction);
const mockedCreate = jest.mocked(createActionPlanAction);

function okSuggestion() {
  mockedSuggest.mockResolvedValue({
    ok: true,
    data: {
      suggestion: {
        what: "Instalar guarda-corpo",
        why: "Queda de altura",
        who: "Manutenção",
        where: "Mezanino",
        when: null,
        how: "Guarda-corpo fixo",
        howMuch: 1500,
        priority: 3,
      },
    },
  });
}

function renderCreator() {
  return render(<AuditPlanCreator originType="risk" originId={ORIGIN_ID} />);
}

const fillButton = () => screen.getByRole("button", { name: "Preencher com IA pgr-e" });

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockedCreate.mockResolvedValue({
    ok: false,
    error: { code: "VALIDATION", message: "erro de teste" },
  });
});

describe("AuditPlanCreator — 5W2H preenchido pela IA pgr-e", () => {
  it("mostra o aviso antes de preencher e só chama a IA depois do aceite", async () => {
    okSuggestion();
    const user = userEvent.setup();
    renderCreator();

    await user.click(fillButton());
    expect(mockedSuggest).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Entendi, preencher" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/O quê/)).toHaveValue("Instalar guarda-corpo"),
    );
    expect(mockedSuggest).toHaveBeenCalledWith("risk", ORIGIN_ID);
  });

  it("cancelar o aviso não chama a IA", async () => {
    const user = userEvent.setup();
    renderCreator();

    await user.click(fillButton());
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mockedSuggest).not.toHaveBeenCalled();
  });

  it("marca os campos preenchidos e tira a marca do campo editado", async () => {
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    okSuggestion();
    const user = userEvent.setup();
    renderCreator();

    await user.click(fillButton());
    await waitFor(() =>
      expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(7),
    );
    await user.type(screen.getByLabelText(/Quem/), " predial");
    expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(6);
  });

  it("pede confirmação antes de criar o plano com conteúdo da IA", async () => {
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    okSuggestion();
    const user = userEvent.setup();
    renderCreator();

    await user.click(fillButton());
    await waitFor(() =>
      expect(screen.getByLabelText(/O quê/)).toHaveValue("Instalar guarda-corpo"),
    );
    await user.click(screen.getByRole("button", { name: "Criar plano" }));
    expect(mockedCreate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Voltar e revisar" }));
    expect(mockedCreate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Criar plano" }));
    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        originType: "risk",
        originId: ORIGIN_ID,
        what: "Instalar guarda-corpo",
        howMuch: 1500,
        priority: 3,
      }),
    );
  });

  it("cria direto, sem confirmação, quando nada veio da IA", async () => {
    const user = userEvent.setup();
    renderCreator();

    await user.type(screen.getByLabelText(/O quê/), "Sinalizar a área");
    await user.click(screen.getByRole("button", { name: "Criar plano" }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("usa os campos do design system, sem select solto", () => {
    const { container } = renderCreator();
    expect(container.querySelector("select:not(.appearance-none)")).toBeNull();
    expect(
      container.querySelectorAll("input.rounded-card, textarea.rounded-card"),
    ).toHaveLength(0);
  });
});
