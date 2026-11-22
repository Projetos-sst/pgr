jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/safety/service-orders", () => ({
  createServiceOrderAction: jest.fn(),
  getSuggestedItemsAction: jest.fn(),
  updateServiceOrderAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/safety/ai-service-order-instructions", () => ({
  suggestServiceOrderInstructions: jest.fn(),
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";
import { suggestServiceOrderInstructions } from "@/shared/server/actions/safety/ai-service-order-instructions";
import { updateServiceOrderAction } from "@/shared/server/actions/safety/service-orders";

import { ServiceOrderForm, type ServiceOrderFormInitial } from "../service-order-form";

const OS_ID = "11111111-1111-4111-8111-1111111111f2";

const INITIAL: ServiceOrderFormInitial = {
  title: "OS de altura",
  osType: null,
  assignedEmployeeId: null,
  workUnitId: null,
  openedAt: "2026-11-20",
  dueDate: null,
  status: "open",
  items: [{ description: "Usar capacete", sourceType: "manual", sourceId: null }],
};

const mockedSuggest = jest.mocked(suggestServiceOrderInstructions);
const mockedUpdate = jest.mocked(updateServiceOrderAction);

function okInstructions() {
  mockedSuggest.mockResolvedValue({
    ok: true,
    data: {
      suggestions: [
        { description: "Usar cinto paraquedista" },
        { description: "Usar capacete" },
      ],
    },
  });
}

function renderForm() {
  return render(
    <ServiceOrderForm id={OS_ID} employees={[]} workUnits={[]} initial={INITIAL} />,
  );
}

const fillButton = () => screen.getByRole("button", { name: "Preencher com IA pgr-e" });

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockedUpdate.mockResolvedValue({
    ok: false,
    error: { code: "VALIDATION", message: "erro de teste" },
  });
});

describe("ServiceOrderForm — instruções preenchidas pela IA pgr-e", () => {
  it("mostra o aviso antes de preencher e só chama a IA depois do aceite", async () => {
    okInstructions();
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    expect(mockedSuggest).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Entendi, preencher" }));

    expect(await screen.findByText("Usar cinto paraquedista")).toBeInTheDocument();
    expect(mockedSuggest).toHaveBeenCalledWith(OS_ID);
  });

  it("cancelar o aviso não chama a IA", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mockedSuggest).not.toHaveBeenCalled();
  });

  it("marca só os itens novos que vieram da IA", async () => {
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    okInstructions();
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    expect(await screen.findByText("Usar cinto paraquedista")).toBeInTheDocument();
    expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(1);
  });

  it("pede confirmação antes de salvar com itens da IA e só salva no aceite", async () => {
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    okInstructions();
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    await screen.findByText("Usar cinto paraquedista");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mockedUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Voltar e revisar" }));
    expect(mockedUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate).toHaveBeenCalledWith(
      OS_ID,
      expect.objectContaining({
        items: [
          { description: "Usar capacete", sourceType: "manual", sourceId: undefined },
          {
            description: "Usar cinto paraquedista",
            sourceType: "manual",
            sourceId: undefined,
          },
        ],
      }),
    );
  });

  it("salva direto quando nenhum item veio da IA", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("remover o item da IA dispensa a confirmação", async () => {
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    okInstructions();
    const user = userEvent.setup();
    renderForm();

    await user.click(fillButton());
    await screen.findByText("Usar cinto paraquedista");
    const removeButtons = screen.getAllByRole("button", { name: "Remover" });
    await user.click(removeButtons[removeButtons.length - 1]);
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
  });
});
