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

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
