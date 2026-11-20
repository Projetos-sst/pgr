jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/shared/server/actions/pgr/risks", () => ({
  createRiskAction: jest.fn(),
  updateRiskAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/work-units", () => ({
  listWorkUnitsAction: jest.fn(),
}));
jest.mock("@/shared/server/actions/pgr/ges", () => ({ listGesAction: jest.fn() }));
jest.mock("@/shared/server/actions/pgr/ai-risk-suggestion", () => ({
  fillRisk: jest.fn(),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { fillRisk } from "@/shared/server/actions/pgr/ai-risk-suggestion";
import { createRiskAction } from "@/shared/server/actions/pgr/risks";
import { AI_REVIEW_DISMISSED_KEY } from "@/shared/domains/platform/ai-review";

import { RiskForm } from "../risk-form";

const hazardSuggestions = (container: HTMLElement) =>
  [...container.querySelectorAll("datalist option")].map((option) =>
    option.getAttribute("value"),
  );

const unitLabels = () =>
  within(screen.getByLabelText(/Unidade de medida/))
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("RiskForm — catálogo de agentes e unidades por grupo", () => {
  it("sugere os agentes e destaca as unidades usuais do grupo escolhido", async () => {
    const user = userEvent.setup();
    const { container } = render(<RiskForm companies={[]} />);
    expect(hazardSuggestions(container)).toEqual([]);

    await user.selectOptions(screen.getByLabelText(/Grupo do agente/), "physical");

    expect(hazardSuggestions(container)).toContain("Ruído contínuo ou intermitente");
    expect(unitLabels()).toEqual(
      expect.arrayContaining(["dB(A)", "ppm (fora do usual do grupo)"]),
    );
  });

  it("mantém selecionada a unidade antiga fora do catálogo ao editar", () => {
    render(
      <RiskForm
        companies={[]}
        riskId="risk"
        initial={{ agentType: "chemical", hazard: "Tinta", measurementUnit: "lux" }}
      />,
    );
    expect(screen.getByLabelText(/Unidade de medida/)).toHaveValue("lux");
    expect(screen.getByLabelText(/Perigo/)).toHaveValue("Tinta");
    expect(unitLabels()).toContain("lux (fora do usual do grupo)");
  });
});

const GES_ID = "11111111-1111-1111-1111-111111111111";

const mockedFill = jest.mocked(fillRisk);
const mockedCreate = jest.mocked(createRiskAction);

function renderWithGes() {
  return render(<RiskForm companies={[]} initial={{ gesId: GES_ID }} />);
}

function aiFilled() {
  mockedFill.mockResolvedValue({
    ok: true,
    data: {
      risk: {
        agentType: "physical",
        description: "Ruído da serra circular",
        hazard: "Ruído contínuo",
        propagation: "Via aérea",
        possibleInjuries: "PAIR",
        exposureTime: "habitual",
      },
    },
  });
}

describe("RiskForm — preencher com a IA pgr-e", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(AI_REVIEW_DISMISSED_KEY, "true");
    mockedFill.mockReset();
    mockedCreate.mockReset();
  });

  it("só oferece o preenchimento depois de escolher o GES", () => {
    render(<RiskForm companies={[]} />);
    expect(
      screen.queryByRole("button", { name: "Preencher com IA pgr-e" }),
    ).not.toBeInTheDocument();
  });

  it("preenche os campos, usa o que o usuário digitou como foco e marca o que a IA preencheu", async () => {
    aiFilled();
    const user = userEvent.setup();
    renderWithGes();

    await user.type(screen.getByLabelText(/Fontes geradoras/), "Serra circular");
    await user.type(screen.getByLabelText(/^Descrição/), "Ruído");
    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));

    await waitFor(() =>
      expect(screen.getByLabelText(/Meios de propagação/)).toHaveValue("Via aérea"),
    );
    expect(mockedFill).toHaveBeenCalledWith(GES_ID, {
      agentType: "",
      hazard: "",
      description: "Ruído",
    });
    expect(screen.getByLabelText(/^Descrição/)).toHaveValue("Ruído da serra circular");
    expect(screen.getByLabelText(/Possíveis lesões/)).toHaveValue("PAIR");
    expect(screen.getByLabelText(/Tempo de exposição/)).toHaveValue("habitual");
    expect(screen.getByLabelText(/Grupo do agente/)).toHaveValue("physical");
    expect(screen.getByLabelText(/Fontes geradoras/)).toHaveValue("Serra circular");
    expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(6);
  });

  it("tira a marca da IA do campo que o usuário editou", async () => {
    aiFilled();
    const user = userEvent.setup();
    renderWithGes();

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
    await waitFor(() =>
      expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(6),
    );
    await user.type(screen.getByLabelText(/Meios de propagação/), " e contato");

    expect(screen.getAllByText("Preenchido pela IA pgr-e")).toHaveLength(5);
  });

  it("pede confirmação antes de salvar conteúdo preenchido pela IA", async () => {
    aiFilled();
    mockedCreate.mockResolvedValue({
      ok: false,
      error: { code: "X", message: "falhou" },
    });
    const user = userEvent.setup();
    renderWithGes();

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/Meios de propagação/)).toHaveValue("Via aérea"),
    );
    await user.click(screen.getByRole("button", { name: "Criar risco" }));

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Confirmar conteúdo preenchido pela IA pgr-e"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar e salvar" }));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        gesId: GES_ID,
        agentType: "physical",
        description: "Ruído da serra circular",
        propagation: "Via aérea",
        exposureTime: "habitual",
      }),
    );
  });

  it("salva direto quando nada foi preenchido pela IA", async () => {
    mockedCreate.mockResolvedValue({
      ok: false,
      error: { code: "X", message: "falhou" },
    });
    const user = userEvent.setup();
    renderWithGes();

    await user.click(screen.getByRole("button", { name: "Criar risco" }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText("Confirmar conteúdo preenchido pela IA pgr-e"),
    ).not.toBeInTheDocument();
  });

  it("explica a cota mensal estourada", async () => {
    mockedFill.mockResolvedValue({
      ok: false,
      error: { code: "QUOTA_EXCEEDED", message: "cru" },
    });
    const user = userEvent.setup();
    renderWithGes();

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));

    expect(await screen.findByText(/limite mensal/)).toBeInTheDocument();
  });

  it("avisa quando a IA não devolve nenhum risco", async () => {
    mockedFill.mockResolvedValue({ ok: true, data: { risk: null } });
    const user = userEvent.setup();
    renderWithGes();

    await user.click(screen.getByRole("button", { name: "Preencher com IA pgr-e" }));

    expect(await screen.findByText(/não conseguiu preencher/)).toBeInTheDocument();
  });
});
